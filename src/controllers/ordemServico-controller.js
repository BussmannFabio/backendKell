import {
  OrdemServico,
  OrdemItem,
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  Financeiro,
  EstoqueMaterial,
  Material,
  Confeccao,
  sequelize
} from '../models/index.js';
import { Op, fn, col } from 'sequelize';

/** Helper utilitário: formata Date/string para YYYY-MM-DD (local) */
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

async function resolveProduto(produtoIdOrCodigo, transaction = null) {
  if (produtoIdOrCodigo == null) return null;
  const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
  if (byPk) return byPk;
  const codigo = String(produtoIdOrCodigo).trim();
  if (!codigo) return null;
  return await Produto.findOne({ where: { codigo }, transaction });
}

// ---------------------- CRIAR ORDEM ----------------------
export const criarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { itens, dataInicio, confeccaoId } = req.body;

    if (!confeccaoId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'confeccaoId é obrigatório' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Itens da ordem são obrigatórios' });
    }

    const dataInicioNorm = formatDateToYYYYMMDD(dataInicio);
    const ordem = await OrdemServico.create({ 
      status: 'CRIADA', 
      dataInicio: dataInicioNorm, 
      confeccaoId 
    }, { transaction });

    const resultados = [];

    for (const itemRaw of itens) {
      const volumes = Number(itemRaw.volumes || 0);
      const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
      const produtoIdOrCodigo = itemRaw.produtoId;
      const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

      const produto = await resolveProduto(produtoIdOrCodigo, transaction);
      if (!produto) {
        resultados.push({ item: itemRaw, status: 'erro', mensagem: 'Produto não encontrado' });
        continue;
      }

      let produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: produto.id, tamanho: tamanhoRaw },
        transaction
      });

      if (!produtoTamanho) {
        resultados.push({ item: itemRaw, status: 'erro', mensagem: 'Tamanho não encontrado' });
        continue;
      }

      const pecasEsperadas = volumes * pecasPorVolume;

      await OrdemItem.create({
        ordemId: ordem.id,
        produtoId: produto.id,
        produtoTamanhoId: produtoTamanho.id,
        tamanho: tamanhoRaw,
        volumes,
        pecasPorVolume,
        pecasEsperadas,
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
      resultados.push({ item: itemRaw, status: 'ok' });
    }

    await transaction.commit();
    const ordemCompleta = await OrdemServico.findByPk(ordem.id, { include: ['itens', 'confeccao'] });
    return res.status(201).json({ success: true, ordem: ordemCompleta });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- RETORNAR ORDEM (COM FECHAMENTO FINANCEIRO) ----------------------
export const retornarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { itens: itensRecebidos = [], retornoTotal = false, fecharSemQuantidade = false } = req.body;

    const ordemServico = await OrdemServico.findByPk(id, {
      include: ['itens', 'confeccao'],
      transaction
    });

    if (!ordemServico || ordemServico.status === 'RETORNADA') {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Ordem inválida ou já retornada' });
    }

    let acumuladoEsperado = 0;
    let acumuladoReal = 0;
    let acumuladoDefeito = 0;

    for (const itemOrdem of ordemServico.itens) {
      const itemFront = itensRecebidos.find(i => String(i.id) === String(itemOrdem.id));
      const pecasEsperadasAntes = Number(itemOrdem.pecasEsperadas || 0);
      
      let pecasRetornadas = 0;
      if (itensRecebidos.length > 0) {
        pecasRetornadas = Number(itemFront?.pecasRetornadas || 0);
      } else if (retornoTotal && !fecharSemQuantidade) {
        pecasRetornadas = pecasEsperadasAntes;
      }

      const defeitos = Number(itemFront?.pecasComDefeito || 0);
      const pecasBoas = Math.max(pecasRetornadas - defeitos, 0);

      // Lógica de Estoque
      const reducaoAberta = (retornoTotal || fecharSemQuantidade) ? pecasEsperadasAntes : pecasRetornadas;
      
      let estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: itemOrdem.produtoTamanhoId }, 
        transaction 
      });

      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - reducaoAberta, 0);
        estoque.quantidadePronta = Number(estoque.quantidadePronta || 0) + peasBoas;
        await estoque.save({ transaction });
      }

      // Atualiza Item
      itemOrdem.pecasReais = Number(itemOrdem.pecasReais || 0) + pecasBoas;
      itemOrdem.pecasDefeituosas = Number(itemOrdem.pecasDefeituosas || 0) + defeitos;
      itemOrdem.pecasEsperadas = (retornoTotal || fecharSemQuantidade) ? 0 : Math.max(pecasEsperadasAntes - reducaoAberta, 0);
      await itemOrdem.save({ transaction });

      // Cálculos Financeiros por item
      const produto = await Produto.findByPk(itemOrdem.produtoId, { transaction });
      const valorUnit = (produto?.valorMaoDeObraDuzia || 0) / 12;
      const totalPagar = (pecasBoas + defeitos) * valorUnit;

      await Financeiro.create({
        ordemId: id,
        confeccaoId: ordemServico.confeccaoId,
        valorMaoDeObra: totalPagar,
        pecasProduzidas: pecasBoas + defeitos,
        status: 'ABERTO'
      }, { transaction });

      acumuladoEsperado += pecasEsperadasAntes;
      acumuladoReal += (pecasBoas + defeitos);
      acumuladoDefeito += defeitos;
    }

    // FECHAMENTO DA OS
    const finalizada = (ordemServico.itens.every(i => i.pecasEsperadas === 0));
    const statusFinal = finalizada ? 'RETORNADA' : 'EM_PRODUCAO';
    
    // 🔥 Grava o resumo na Ordem
    await ordemServico.update({
      status: statusFinal,
      dataRetorno: finalizada ? formatDateToYYYYMMDD(new Date()) : null,
      totalPecasEsperadas: acumuladoEsperado,
      totalPecasReais: acumuladoReal,
      // Exemplo de cálculo de quebra:
      diferencaPecas: acumuladoReal - acumuladoEsperado
    }, { transaction });

    await transaction.commit();
    return res.json({ success: true, status: statusFinal });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- REABRIR ORDEM ----------------------
export const reabrirOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { include: ['itens'], transaction });

    if (!ordem || (ordem.status !== 'RETORNADA' && ordem.status !== 'EM_PRODUCAO')) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Ordem não pode ser reaberta' });
    }

    for (const item of ordem.itens) {
      const pecasReais = Number(item.pecasReais || 0);
      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: item.produtoTamanhoId }, transaction });
      
      if (estoque && pecasReais > 0) {
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta) - pecasReais, 0);
        estoque.quantidadeAberta = Number(estoque.quantidadeAberta) + pecasReais;
        await estoque.save({ transaction });
      }

      item.pecasEsperadas = Number(item.pecasEsperadas) + pecasReais;
      item.pecasReais = 0;
      item.pecasDefeituosas = 0;
      await item.save({ transaction });
    }

    await Financeiro.destroy({ where: { ordemId: id }, transaction });
    await ordem.update({ status: 'CRIADA', dataRetorno: null, totalPecasReais: 0 }, { transaction });

    await transaction.commit();
    return res.json({ success: true, message: 'Ordem reaberta com sucesso' });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- LISTAGEM E BUSCA ----------------------
export const listarOrdens = async (req, res) => {
  try {
    const ordens = await OrdemServico.findAll({
      include: ['itens', 'confeccao'],
      order: [['createdAt', 'DESC']]
    });
    return res.json({ success: true, ordens });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const buscarOrdemPorId = async (req, res) => {
  try {
    const ordem = await OrdemServico.findByPk(req.params.id, { include: ['itens', 'confeccao'] });
    if (!ordem) return res.status(404).json({ success: false, error: 'Não encontrada' });
    return res.json({ success: true, ordem });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const deletarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { include: ['itens'], transaction });
    if (!ordem) return res.status(404).json({ success: false, error: 'Não encontrada' });

    // Reverter estoque antes de deletar
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