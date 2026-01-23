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

// ---------------------- LISTAGEM (Otimizada) ----------------------
export const listarOrdens = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    
    if (status === 'ABERTA') {
      where.status = { [Op.ne]: 'RETORNADA' };
    } else if (status && status !== 'undefined' && status !== 'null') {
      // Se vier um status específico (ex: 'CRIADA'), filtra por ele
      where.status = status;
    }
    // Se o status for vazio/undefined (como faremos no Angular), 
    // o 'where' continua vazio {} e traz TODAS as ordens.

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

// ---------------------- RETORNAR ORDEM (FECHAMENTO) ----------------------
export const retornarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { itens: itensRecebidos = [], retornoTotal = false, fecharSemQuantidade = false } = req.body;

    const ordemServico = await OrdemServico.findByPk(id, {
      include: [{ model: OrdemItem, as: 'itens', include: [{ model: Produto, as: 'produto' }] }],
      transaction
    });

    if (!ordemServico || ordemServico.status === 'RETORNADA') {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Ordem inválida ou já retornada' });
    }

    let acumuladoRealFinal = 0;

    for (const itemOrdem of ordemServico.itens) {
      const itemFront = itensRecebidos.find(i => String(i.id) === String(itemOrdem.id));
      const pecasPendenteNoItem = Number(itemOrdem.pecasEsperadas || 0);
      
      let pecasSendoEntregues = 0;
      if (itensRecebidos.length > 0) {
        pecasSendoEntregues = Number(itemFront?.pecasRetornadas || 0);
      } else if (retornoTotal && !fecharSemQuantidade) {
        pecasSendoEntregues = pecasPendenteNoItem;
      }

      const defeitos = Number(itemFront?.pecasComDefeito || 0);
      const pecasBoas = Math.max(pecasSendoEntregues - defeitos, 0);
      const reducaoEstoqueAberto = (retornoTotal || fecharSemQuantidade) ? pecasPendenteNoItem : pecasSendoEntregues;
      
      let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: itemOrdem.produtoTamanhoId }, transaction });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - reducaoEstoqueAberto, 0);
        estoque.quantidadePronta = Number(estoque.quantidadePronta || 0) + pecasBoas;
        await estoque.save({ transaction });
      }

      itemOrdem.pecasReais = Number(itemOrdem.pecasReais || 0) + pecasBoas;
      itemOrdem.pecasDefeituosas = Number(itemOrdem.pecasDefeituosas || 0) + defeitos;
      itemOrdem.pecasEsperadas = (retornoTotal || fecharSemQuantidade) ? 0 : Math.max(pecasPendenteNoItem - reducaoEstoqueAberto, 0);
      await itemOrdem.save({ transaction });

      const valorUnit = (Number(itemOrdem.produto?.valorMaoDeObraDuzia || 0)) / 12;
      const valorLancamento = (pecasBoas + defeitos) * valorUnit;

      if (valorLancamento > 0) {
        await Financeiro.create({
          ordemId: id,
          confeccaoId: ordemServico.confeccaoId,
          valorMaoDeObra: valorLancamento,
          pecasProduzidas: (pecasBoas + defeitos),
          status: 'ABERTO'
        }, { transaction });
      }

      acumuladoRealFinal += itemOrdem.pecasReais;
    }

    const todosItensEntregues = (ordemServico.itens.every(i => Number(i.pecasEsperadas) <= 0));
    
    await ordemServico.update({
      status: todosItensEntregues ? 'RETORNADA' : 'EM_PRODUCAO',
      dataRetorno: todosItensEntregues ? formatDateToYYYYMMDD(new Date()) : null,
      totalPecasReais: acumuladoRealFinal,
      diferencaPecas: acumuladoRealFinal - Number(ordemServico.totalPecasEsperadas || 0)
    }, { transaction });

    await transaction.commit();
    return res.json({ success: true });
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
      const pecasReaisDesteItem = Number(item.pecasReais || 0);
      
      const estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: item.produtoTamanhoId }, 
        transaction 
      });
      
      if (estoque) {
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta || 0) - pecasReaisDesteItem, 0);
        estoque.quantidadeAberta = Number(estoque.quantidadeAberta || 0) + pecasReaisDesteItem;
        await estoque.save({ transaction });
      }

      item.pecasEsperadas = Number(item.pecasEsperadas || 0) + pecasReaisDesteItem;
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