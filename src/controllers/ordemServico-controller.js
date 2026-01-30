import {
  OrdemServico,
  OrdemItem,
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  Financeiro,
  Confeccao,
  sequelize
} from '../models/index.js';
import { Op } from 'sequelize';

/** Helper utilitário: formata Date/string para YYYY-MM-DD */
function formatDateToYYYYMMDD(input) {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = (input instanceof Date) ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Resolve produto por ID ou Código */
async function resolveProduto(produtoIdOrCodigo, transaction = null) {
  if (produtoIdOrCodigo == null) return null;
  const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
  if (byPk) return byPk;
  const codigo = String(produtoIdOrCodigo).trim();
  if (!codigo) return null;
  return await Produto.findOne({ where: { codigo }, transaction });
}

// ---------------------- LISTAGEM ----------------------
export const listarOrdens = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    
    if (status === 'ABERTA') {
      where.status = { [Op.ne]: 'RETORNADA' };
    } else if (status && status !== 'undefined' && status !== 'null') {
      where.status = status;
    }

    const ordens = await OrdemServico.findAll({
      where,
      include: [
        { model: Confeccao, as: 'confeccao', required: false },
        { 
          model: OrdemItem, 
          as: 'itens',
          required: false,
          include: [{ model: Produto, as: 'produto', required: false }] 
        }
      ],
      order: [['id', 'DESC']] 
    });

    const ordensSanitizadas = ordens.map(o => {
      const item = o.get({ plain: true });
      return {
        ...item,
        totalPecasEsperadas: Number(item.totalPecasEsperadas || 0),
        totalPecasReais: Number(item.totalPecasReais || 0),
        diferencaPecas: Number(item.diferencaPecas || 0)
      };
    });

    return res.json({ success: true, ordens: ordensSanitizadas });
  } catch (error) {
    console.error('[ORDEM][LISTAR] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- CRIAR ORDEM ----------------------
export const criarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { itens, dataInicio, confeccaoId } = req.body;

    if (!confeccaoId) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ success: false, error: 'confeccaoId é obrigatório' });
    }

    const dataInicioNorm = formatDateToYYYYMMDD(dataInicio);
    
    const ordem = await OrdemServico.create({ 
      status: 'CRIADA', 
      dataInicio: dataInicioNorm, 
      confeccaoId,
      totalPecasEsperadas: 0,
      totalPecasReais: 0,
      diferencaPecas: 0
    }, { transaction });

    let somaTotalEsperada = 0;

    for (const itemRaw of itens) {
      const volumes = Number(itemRaw.volumes || 0);
      const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
      const produto = await resolveProduto(itemRaw.produtoId, transaction);
      const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

      if (!produto) continue;

      const produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: produto.id, tamanho: tamanhoRaw },
        transaction
      });

      if (!produtoTamanho) continue;

      const pecasEsperadas = volumes * pecasPorVolume;
      somaTotalEsperada += pecasEsperadas;

      await OrdemItem.create({
        ordemId: ordem.id,
        produtoId: produto.id,
        produtoTamanhoId: produtoTamanho.id,
        tamanho: tamanhoRaw,
        volumes,
        pecasPorVolume,
        pecasEsperadas,
        pecasReais: 0,
        pecasDefeituosas: 0,
        corte: itemRaw.corte ? String(itemRaw.corte) : null
      }, { transaction });

      let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction });
      if (!estoque) {
        await EstoqueProduto.create({
          produtoTamanhoId: produtoTamanho.id,
          quantidadeAberta: pecasEsperadas,
          quantidadePronta: 0
        }, { transaction });
      } else {
        estoque.quantidadeAberta = Number(estoque.quantidadeAberta || 0) + pecasEsperadas;
        await estoque.save({ transaction });
      }
    }

    await ordem.update({ totalPecasEsperadas: somaTotalEsperada }, { transaction });

    await transaction.commit();
    return res.status(201).json({ success: true, id: ordem.id });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('[ORDEM][CRIAR] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- RETORNAR ORDEM (LÓGICA DE 2% BLINDADA) ----------------------
export const retornarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
      itens: itensRecebidos = [], 
      retornoTotal = false, 
      fecharSemQuantidade = false,
      isParcial = false,
      status: statusFrontend 
    } = req.body;

    const ordemServico = await OrdemServico.findByPk(id, {
      include: [{ model: OrdemItem, as: 'itens', include: [{ model: Produto, as: 'produto' }] }],
      transaction
    });

    if (!ordemServico || ordemServico.status === 'RETORNADA') {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Ordem inválida ou já encerrada.' });
    }

    let acumuladoRealFinal = 0;

    for (const itemOrdem of ordemServico.itens) {
      const itemFront = itensRecebidos.find(i => String(i.id) === String(itemOrdem.id));
      
      const metaOriginalDoItem = Number(itemOrdem.volumes || 0) * Number(itemOrdem.pecasPorVolume || 0);
      const pecasPendenteNoMomento = Number(itemOrdem.pecasEsperadas || 0);
      
      let pecasSendoEntreguesAgora = 0;
      if (itemFront) {
        pecasSendoEntreguesAgora = Number(itemFront.pecasRetornadas || 0);
      } else if (retornoTotal && !fecharSemQuantidade) {
        pecasSendoEntreguesAgora = pecasPendenteNoMomento;
      }

      const defeitos = Number(itemFront?.pecasComDefeito || 0);
      const pecasBoas = Math.max(pecasSendoEntreguesAgora - defeitos, 0);
      
      const reducaoEstoqueAberto = (retornoTotal || fecharSemQuantidade) ? pecasPendenteNoMomento : pecasSendoEntreguesAgora;
      
      let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: itemOrdem.produtoTamanhoId }, transaction });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - reducaoEstoqueAberto, 0);
        estoque.quantidadePronta = Number(estoque.quantidadePronta || 0) + pecasBoas;
        await estoque.save({ transaction });
      }

      // Atualizar Item
      itemOrdem.pecasReais = Number(itemOrdem.pecasReais || 0) + pecasBoas;
      itemOrdem.pecasDefeituosas = Number(itemOrdem.pecasDefeituosas || 0) + defeitos;
      
      if (retornoTotal || fecharSemQuantidade) {
        itemOrdem.pecasEsperadas = 0;
      } else {
        itemOrdem.pecasEsperadas = Math.max(pecasPendenteNoMomento - reducaoEstoqueAberto, 0);
      }
      await itemOrdem.save({ transaction });

      // --- LÓGICA FINANCEIRA DE BÔNUS/ÔNUS (REGRA 2%) ---
      const valorUnitario = (Number(itemOrdem.produto?.valorMaoDeObraDuzia || 0)) / 12;
      const valorTrabalhoRealizado = (pecasBoas + defeitos) * valorUnitario;
      
      let saldoBonusOnus = 0;
      // Só calculamos o bônus/ônus quando o item é finalizado (esperado chega a 0)
      if (itemOrdem.pecasEsperadas === 0) {
        const meta98PorCento = metaOriginalDoItem * 0.98;
        const totalEntregue = itemOrdem.pecasReais + itemOrdem.pecasDefeituosas;
        // Ex: 100 entregues - 98 meta = +2 bônus | 96 entregues - 98 meta = -2 ônus
        saldoBonusOnus = totalEntregue - meta98PorCento;
      }

      if (valorTrabalhoRealizado > 0 || Math.abs(saldoBonusOnus) > 0) {
        await Financeiro.create({
          ordemId: id,
          confeccaoId: ordemServico.confeccaoId,
          valorMaoDeObra: valorTrabalhoRealizado,
          pecasProduzidas: (pecasBoas + defeitos),
          // Diferença positiva = bônus, Diferença negativa = ônus
          diferenca: Math.round(saldoBonusOnus * 100) / 100,
          status: 'ABERTO'
        }, { transaction });
      }

      acumuladoRealFinal += itemOrdem.pecasReais;
    }

    // Status da Ordem
    let novoStatus = 'EM_PRODUCAO';
    if (statusFrontend === 'RETORNADA' || retornoTotal || fecharSemQuantidade) {
      novoStatus = 'RETORNADA';
    } else {
      const itensAbertos = await OrdemItem.count({ where: { ordemId: id, pecasEsperadas: { [Op.gt]: 0 } }, transaction });
      novoStatus = itensAbertos === 0 ? 'RETORNADA' : 'EM_PRODUCAO';
    }

    await OrdemServico.update({
      status: novoStatus,
      dataRetorno: novoStatus === 'RETORNADA' ? formatDateToYYYYMMDD(new Date()) : null,
      totalPecasReais: acumuladoRealFinal,
      // Diferença de peças geral da OS contra meta 100%
      diferencaPecas: acumuladoRealFinal - Number(ordemServico.totalPecasEsperadas || 0)
    }, { where: { id }, transaction });

    await transaction.commit();
    return res.json({ success: true, status: novoStatus });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('[ORDEM][RETORNO] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- REABRIR ORDEM ----------------------
export const reabrirOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { 
      include: [{ model: OrdemItem, as: 'itens' }], 
      transaction 
    });

    if (!ordem) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
    }

    for (const item of ordem.itens) {
      const pecasProduzidas = Number(item.pecasReais || 0);
      const estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: item.produtoTamanhoId }, 
        transaction 
      });
      
      if (estoque) {
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta || 0) - pecasProduzidas, 0);
        estoque.quantidadeAberta = Number(estoque.quantidadeAberta || 0) + pecasProduzidas;
        await estoque.save({ transaction });
      }

      item.pecasEsperadas = Number(item.pecasEsperadas || 0) + pecasProduzidas;
      item.pecasReais = 0;
      item.pecasDefeituosas = 0;
      await item.save({ transaction });
    }

    await Financeiro.destroy({ where: { ordemId: id }, transaction });
    await ordem.update({ 
      status: 'CRIADA', 
      dataRetorno: null, 
      totalPecasReais: 0,
      diferencaPecas: 0 
    }, { transaction });

    await transaction.commit();
    return res.json({ success: true });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('[ORDEM][REABRIR] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- BUSCA POR ID ----------------------
export const buscarOrdemPorId = async (req, res) => {
  try {
    const ordem = await OrdemServico.findByPk(req.params.id, { 
      include: [
        { model: Confeccao, as: 'confeccao' },
        { model: OrdemItem, as: 'itens', include: [{ model: Produto, as: 'produto' }] }
      ] 
    });
    if (!ordem) return res.status(404).json({ success: false, error: 'Não encontrada' });
    return res.json({ success: true, ordem });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- DELETAR ORDEM ----------------------
export const deletarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { include: ['itens'], transaction });
    
    if (!ordem) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
    }

    for (const item of ordem.itens) {
      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: item.produtoTamanhoId }, transaction });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta) - Number(item.pecasEsperadas), 0);
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta) - Number(item.pecasReais), 0);
        await estoque.save({ transaction });
      }
    }

    await Financeiro.destroy({ where: { ordemId: id }, transaction });
    await OrdemItem.destroy({ where: { ordemId: id }, transaction });
    await ordem.destroy({ transaction });

    await transaction.commit();
    return res.json({ success: true });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).json({ success: false, error: error.message });
  }
};