// src/controllers/ordemServico-controller.js
import {
  OrdemServico, OrdemItem, Produto, ProdutoTamanho, EstoqueProduto,
  Financeiro, EstoqueMaterial, Material, Confeccao, sequelize
} from '../models/index.js';
import { Op, fn, col } from 'sequelize';

/**
 * Helper: resolve produto aceitando tanto id (PK) quanto codigo.
 * Retorna a instância do Produto ou null.
 */
async function resolveProduto(produtoIdOrCodigo, transaction = null) {
  if (produtoIdOrCodigo == null) return null;

  // tentar buscar por PK (número)
  const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
  if (byPk) return byPk;

  // fallback: buscar por codigo (string) com trim
  const codigo = String(produtoIdOrCodigo).trim();
  if (!codigo) return null;
  const byCodigo = await Produto.findOne({ where: { codigo }, transaction });
  return byCodigo;
}

// ---------------------- CRIAR ORDEM ----------------------
export const criarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { itens, dataInicio, confeccaoId } = req.body;
    console.log('[CRIA-OS][INICIO]', { itensCount: (itens || []).length, dataInicio, confeccaoId });

    if (!confeccaoId) {
      console.warn('[CRIA-OS][VALIDACAO] confeccaoId faltando');
      await t.rollback();
      return res.status(400).json({ success: false, error: 'confeccaoId é obrigatório' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      console.warn('[CRIA-OS][VALIDACAO] itens faltando');
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Itens da ordem são obrigatórios' });
    }

    const ordem = await OrdemServico.create({ status: 'CRIADA', dataInicio, confeccaoId }, { transaction: t });
    console.log('[CRIA-OS] OS criada com ID=', ordem.id);

    const resultados = [];

    for (const itemRaw of itens) {
      try {
        const itemRawLog = { ...itemRaw };
        // Normalize numbers
        const volumes = Number(itemRaw.volumes || 0);
        const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
        const produtoIdOrCodigo = itemRaw.produtoId;
        // normalize tamanho (trim + uppercase)
        const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

        if (!produtoIdOrCodigo || !tamanhoRaw || volumes <= 0 || pecasPorVolume <= 0) {
          console.warn('[CRIA-OS][ITEM][SKIP] dados incompletos', itemRawLog);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Dados incompletos' });
          continue;
        }

        // Resolve o produto (aceita id PK ou codigo)
        const produto = await resolveProduto(produtoIdOrCodigo, t);
        if (!produto) {
          console.error('[CRIA-OS][ERRO] Produto não encontrado para valor:', produtoIdOrCodigo);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Produto não encontrado' });
          continue;
        }

        // Verifica se existe ProdutoTamanho para este produto.id e tamanho normalizado
        let produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: produto.id, tamanho: tamanhoRaw },
          transaction: t
        });

        // fallback case-insensitive / DB dirty data
        if (!produtoTamanho) {
          produtoTamanho = await ProdutoTamanho.findOne({
            where: {
              produtoId: produto.id,
              [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoRaw)
            },
            transaction: t
          });
        }

        if (!produtoTamanho) {
          console.error('[CRIA-OS][ERRO] ProdutoTamanho não encontrado', { produtoId: produto.id, tamanho: tamanhoRaw });
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Tamanho do produto não encontrado' });
          continue;
        }

        // Calcular peças esperadas
        const pecasEsperadas = volumes * pecasPorVolume;

        // Criar OrdemItem usando produto.id (PK) para consistência
        const ordemItem = await OrdemItem.create({
          ordemId: ordem.id,
          produtoId: produto.id,
          produtoTamanhoId: produtoTamanho.id, // mantém ligação direta
          tamanho: tamanhoRaw,
          volumes,
          pecasPorVolume,
          pecasEsperadas,
          corte: itemRaw.corte ? String(itemRaw.corte) : null
        }, { transaction: t });
        console.log('[CRIA-OS] OrdemItem criada ID=', ordemItem.id, { produtoTamanhoId: produtoTamanho.id });

        // Atualiza ou cria EstoqueProduto (sempre por produtoTamanho.id)
        let estoque = await EstoqueProduto.findOne({
          where: { produtoTamanhoId: produtoTamanho.id },
          transaction: t
        });

        if (!estoque) {
          estoque = await EstoqueProduto.create({
            produtoTamanhoId: produtoTamanho.id,
            quantidadeAberta: pecasEsperadas,
            quantidadePronta: 0
          }, { transaction: t });
          console.log('[CRIA-OS][ESTOQUE] Novo estoque criado', {
            produtoTamanhoId: produtoTamanho.id,
            aberta: estoque.quantidadeAberta,
            pronta: estoque.quantidadePronta
          });
        } else {
          const abertaExistente = Number(estoque.quantidadeAberta || 0);
          estoque.quantidadeAberta = abertaExistente + pecasEsperadas;
          await estoque.save({ transaction: t });
          console.log('[CRIA-OS][ESTOQUE] Estoque atualizado', {
            produtoTamanhoId: produtoTamanho.id,
            aberta: estoque.quantidadeAberta,
            pronta: estoque.quantidadePronta
          });
        }

        resultados.push({ item: itemRawLog, status: 'ok', pecasEsperadas, produtoTamanhoId: produtoTamanho.id, estoqueId: estoque.id });

      } catch (itemError) {
        console.error('[CRIA-OS][ERRO][ITEM]', itemError);
        resultados.push({ item: itemRaw, status: 'erro', mensagem: itemError.message });
      }
    }

    await t.commit();
    console.log('[CRIA-OS][SUCESSO] OS', ordem.id, 'criada');

    // Inclui 'itens' e 'confeccao' para que o frontend encontre ordem.confeccao
    const ordemCompleta = await OrdemServico.findByPk(ordem.id, { include: ['itens', 'confeccao'] });
    return res.status(201).json({ success: true, ordem: ordemCompleta, detalhesItens: resultados });

  } catch (error) {
    await t.rollback();
    console.error('[CRIA-OS][ERRO] Falha geral ao criar ordem', error);
    return res.status(500).json({ success: false, error: 'Falha ao criar ordem', message: error.message });
  }
};

// ---------------------- RETORNAR ORDEM ----------------------
// Agora com tratamento de pecasComDefeito (alocação sequencial por item).
export const retornarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];
    const retornoTotal = req.body.retornoTotal === true;
    const pecasComDefeito = Number(req.body.pecasComDefeito || 0);

    console.log('[RETORNO-OS][INICIO]', { id, itensRecebidosCount: itensRecebidos.length, retornoTotal, pecasComDefeito });

    if (!Number.isFinite(pecasComDefeito) || pecasComDefeito < 0) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'pecasComDefeito inválido' });
    }

    const ordem = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'], transaction: t });
    if (!ordem) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'OS não encontrada' });
    }
    if (ordem.status === 'RETORNADA') {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'OS já retornada' });
    }

    // calcula total pendentes da OS e total digitado pelo front (quando aplicável)
    const totalPendentes = ordem.itens.reduce((s, it) => s + Number(it.pecasEsperadas || 0), 0);
    let totalDigitado = 0;
    if (retornoTotal) {
      totalDigitado = totalPendentes;
    } else {
      for (const it of ordem.itens) {
        const f = itensRecebidos.find(i =>
          (i.id && String(i.id) === String(it.id)) ||
          (i.produtoId && String(i.produtoId) === String(it.produtoId) && String(i.tamanho).trim().toUpperCase() === String(it.tamanho).trim().toUpperCase())
        );
        totalDigitado += Number((f && f.pecasRetornadas) ? f.pecasRetornadas : 0);
      }
    }

    const maxForDefeito = retornoTotal ? totalPendentes : totalDigitado;
    if (pecasComDefeito > maxForDefeito) {
      await t.rollback();
      return res.status(400).json({ success: false, error: `pecasComDefeito (${pecasComDefeito}) excede o máximo permitido (${maxForDefeito})` });
    }

    const resultados = [];
    let totalRestanteDepois = 0;

    // agora distribuímos os defeitos sequencialmente entre os itens recebidos
    let restanteDefeito = pecasComDefeito;

    for (const item of ordem.itens) {
      try {
        // encontra correspondência do front (por id ou por produto+tamanho)
        const frontendItem = itensRecebidos.find(i =>
          (i.id && String(i.id) === String(item.id)) ||
          (i.produtoId && String(i.produtoId) === String(item.produtoId) && String(i.tamanho).trim().toUpperCase() === String(item.tamanho).trim().toUpperCase())
        );

        const pecasEsperadasAntes = Number(item.pecasEsperadas || 0);

        // se retornoTotal, consideramos todas as peças como "digitadas" para este retorno
        const pecasDigitadas = retornoTotal ? pecasEsperadasAntes : Number(frontendItem ? (frontendItem.pecasRetornadas || 0) : 0);

        // aloca defeitos para este item (consome restanteDefeito sequencialmente)
        const defeitoAlocado = Math.min(pecasDigitadas, restanteDefeito);
        restanteDefeito = Math.max(0, restanteDefeito - defeitoAlocado);

        // peças que realmente irão para 'pronta' (não-defeituosas) - limitadas ao esperado
        const pecasParaPronta = Math.min(Math.max(pecasDigitadas - defeitoAlocado, 0), pecasEsperadasAntes);

        // quanto iremos reduzir de 'aberta' no estoque: sempre pelo total devolvido (inclui defeitos)
        const reduzirAberta = retornoTotal ? pecasEsperadasAntes : Math.min(pecasDigitadas, pecasEsperadasAntes);

        // após operação, quantas peças ficam pendentes na OS
        const pecasRestantesNaOS = retornoTotal ? 0 : Math.max(pecasEsperadasAntes - pecasDigitadas, 0);

        console.log('[RETORNO-OS] itemId=', item.id,
          'digitadas=', pecasDigitadas,
          'defeitoAlocado=', defeitoAlocado,
          'paraPronta=', pecasParaPronta,
          'reduzirAberta=', reduzirAberta,
          'restantesNaOS=', pecasRestantesNaOS
        );

        // localizar ProdutoTamanho (normalize tamanho)
        const tamanhoNorm = String(item.tamanho || '').trim().toUpperCase();

        let produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: item.produtoId, tamanho: tamanhoNorm },
          transaction: t
        });

        if (!produtoTamanho) {
          // fallback: busca case-insensitive / resolve produto por codigo se necessário
          const produtoResolve = await resolveProduto(item.produtoId, t);
          if (produtoResolve) {
            produtoTamanho = await ProdutoTamanho.findOne({
              where: { produtoId: produtoResolve.id, [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoNorm) },
              transaction: t
            });
          }
        }

        if (!produtoTamanho) {
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'ProdutoTamanho não encontrado' });
          continue;
        }

        // atualiza ou cria estoque:
        let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction: t });
        if (!estoque) {
          // estado inicial pós-retorno: aberta reduzida pelo que foi devolvido, pronta recebe apenas as não-defeituosas
          const abertaInicial = Math.max(0, pecasEsperadasAntes - reduzirAberta);
          const prontaInicial = pecasParaPronta;
          estoque = await EstoqueProduto.create({
            produtoTamanhoId: produtoTamanho.id,
            quantidadeAberta: abertaInicial,
            quantidadePronta: prontaInicial
          }, { transaction: t });
        } else {
          estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - reduzirAberta, 0);
          estoque.quantidadePronta = Number(estoque.quantidadePronta || 0) + pecasParaPronta;
          await estoque.save({ transaction: t });
        }

        // atualiza item da OS: acumula pecasReais com o que foi efetivamente enviado para pronta,
        // e ajusta pecasEsperadas conforme o que restou (ou 0 se retornoTotal)
        item.pecasReais = Number(item.pecasReais || 0) + pecasParaPronta;
        item.pecasEsperadas = pecasRestantesNaOS;
        await item.save({ transaction: t });

        // financeiro: **usar o total retornado (pecasDigitadas)** — inclui peças com defeito
        const produtoForCalc = await Produto.findByPk(item.produtoId, { transaction: t });
        const duzias = pecasDigitadas / 12;
        const valorMaoDeObra = produtoForCalc && produtoForCalc.valorMaoDeObraDuzia
          ? Number(produtoForCalc.valorMaoDeObraDuzia) * duzias
          : 0;

        const financeiro = await Financeiro.create({
          ordemId: ordem.id,
          confeccaoId: ordem.confeccaoId,
          valorMaoDeObra,
          // diferenca guarda variação entre retornado e esperado (pode ser negativo/positivo)
          diferenca: pecasDigitadas - pecasEsperadasAntes,
          status: 'ABERTO'
        }, { transaction: t });

        totalRestanteDepois += pecasRestantesNaOS;
        resultados.push({
          itemId: item.id,
          status: 'ok',
          pecasDigitadas,
          defeitoAlocado,
          pecasParaPronta,
          reduzirAberta,
          estoqueId: estoque.id,
          financeiroId: financeiro.id
        });

      } catch (itemError) {
        console.error('[RETORNO-OS][ERRO][ITEM]', item.id, itemError);
        resultados.push({ itemId: item.id, status: 'erro', mensagem: itemError.message });
      }
    }

    // define status da OS com base no total restante
    if (totalRestanteDepois > 0) {
      await ordem.update({ status: 'EM_PRODUCAO', dataRetorno: null }, { transaction: t });
    } else {
      await ordem.update({ status: 'RETORNADA', dataRetorno: new Date() }, { transaction: t });
    }

    await t.commit();
    const ordemAtualizada = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'] });
    console.log('[RETORNO-OS][SUCESSO] ordem retornada id=', id);
    return res.json({ success: true, ordem: ordemAtualizada, detalhesItens: resultados });

  } catch (error) {
    await t.rollback();
    console.error('[RETORNO-OS][ERRO] Falha geral', error);
    return res.status(500).json({ success: false, error: 'Falha ao retornar ordem', message: error.message });
  }
};

// ---------------------- REABRIR ORDEM ----------------------
export const reabrirOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    console.log('[REABRIR-OS][INICIO] id=', id);

    const ordem = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'], transaction: t });
    if (!ordem) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'OS não encontrada' });
    }

    if (!['RETORNADA', 'EM_PRODUCAO'].includes(ordem.status)) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Somente OS retornadas ou em produção podem ser reabertas' });
    }

    await ordem.update({ status: 'CRIADA', dataRetorno: null }, { transaction: t });
    console.log('[REABRIR-OS] status setado para CRIADA id=', id);

    const resultados = [];

    for (const item of ordem.itens) {
      try {
        const pecasReais = Number(item.pecasReais || 0);
        if (pecasReais <= 0) {
          resultados.push({ itemId: item.id, status: 'ok', mensagem: 'Nenhuma peça pronta para reverter', pecasRevertidas: 0 });
          continue;
        }

        // localizar ProdutoTamanho (normalize tamanho)
        const tamanhoNorm = String(item.tamanho || '').trim().toUpperCase();

        const produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: item.produtoId, [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoNorm) },
          transaction: t
        });

        if (!produtoTamanho) {
          console.warn('[REABRIR-OS][AVISO] ProdutoTamanho não encontrado para item', item.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'ProdutoTamanho não encontrado', pecasRevertidas: 0 });
          continue;
        }

        const estoque = await EstoqueProduto.findOne({
          where: { produtoTamanhoId: produtoTamanho.id },
          transaction: t
        });

        if (!estoque) {
          console.warn('[REABRIR-OS][AVISO] EstoqueProduto não encontrado para produtoTamanhoId', produtoTamanho.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'Estoque não encontrado', pecasRevertidas: 0 });
          continue;
        }

        // Reverter estoque
        const prontaAntes = Number(estoque.quantidadePronta || 0);
        const abertaAntes = Number(estoque.quantidadeAberta || 0);

        const retirar = Math.min(prontaAntes, pecasReais);
        estoque.quantidadePronta = Math.max(prontaAntes - retirar, 0);
        estoque.quantidadeAberta = abertaAntes + retirar;
        await estoque.save({ transaction: t });

        // Atualiza o item
        item.pecasEsperadas = Number(item.pecasEsperadas || 0) + retirar;
        item.pecasReais = Math.max(pecasReais - retirar, 0);
        await item.save({ transaction: t });

        resultados.push({ itemId: item.id, status: 'ok', pecasRevertidas: retirar, estoqueId: estoque.id });

      } catch (errItem) {
        console.error('[REABRIR-OS][ERRO][ITEM]', item.id, errItem);
        resultados.push({ itemId: item.id, status: 'erro', mensagem: errItem.message });
      }
    }

    try {
      await Financeiro.destroy({ where: { ordemId: ordem.id, confeccaoId: ordem.confeccaoId }, transaction: t });
      console.log('[REABRIR-OS][FINANCEIRO] lançamentos removidos ordemId=', ordem.id);
    } catch (errFin) {
      console.error('[REABRIR-OS][ERRO][FINANCEIRO] ao remover lançamentos', errFin);
    }

    await t.commit();

    const ordemAtualizada = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'] });
    console.log('[REABRIR-OS][SUCESSO] ordem reaberta id=', id);

    return res.json({ success: true, ordem: ordemAtualizada, detalhesItens: resultados });

  } catch (error) {
    await t.rollback();
    console.error('[REABRIR-OS][ERRO] Falha geral', error);
    return res.status(500).json({ success: false, error: 'Falha ao reabrir ordem', message: error.message });
  }
};

// ---------------------- LISTAR / BUSCAR ORDEM ----------------------
export const listarOrdens = async (req, res) => {
  try {
    const ordens = await OrdemServico.findAll({ include: ['itens', 'confeccao'] });
    return res.json({ success: true, ordens });
  } catch (error) {
    console.error('[LISTAR-OS][ERRO]', error);
    return res.status(500).json({ success: false, error: 'Falha ao listar ordens', message: error.message });
  }
};

export const buscarOrdemPorId = async (req, res) => {
  try {
    const ordem = await OrdemServico.findByPk(req.params.id, { include: ['itens', 'confeccao'] });
    if (!ordem) return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
    return res.json({ success: true, ordem });
  } catch (error) {
    console.error('[BUSCAR-OS][ERRO]', error);
    return res.status(500).json({ success: false, error: 'Falha ao buscar ordem', message: error.message });
  }
};

// ---------------------- DELETAR ORDEM ----------------------
export const deletarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { include: ['itens'], transaction: t });
    if (!ordem) return res.status(404).json({ success: false, error: 'Ordem não encontrada' });

    for (const item of ordem.itens) {
      const tamanhoNorm = String(item.tamanho || '').trim().toUpperCase();
      const produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: item.produtoId, [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoNorm) },
        transaction: t
      });
      if (!produtoTamanho) continue;

      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction: t });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - (item.pecasEsperadas || 0), 0);
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta || 0) - (item.pecasReais || 0), 0);
        await estoque.save({ transaction: t });
      }
      await item.destroy({ transaction: t });
    }

    await Financeiro.destroy({ where: { ordemId: ordem.id }, transaction: t });
    await ordem.destroy({ transaction: t });
    await t.commit();

    console.log('[DELETAR-OS] Ordem', id, 'deletada com sucesso');
    return res.json({ success: true, message: 'Ordem de serviço excluída com sucesso!' });

  } catch (error) {
    await t.rollback();
    console.error('[DELETAR-OS][ERRO]', error);
    return res.status(500).json({ success: false, error: 'Falha ao deletar ordem', message: error.message });
  }
};

// ---------------------- ESTOQUE / FINANCEIRO ----------------------
export const getEstoqueMateriais = async (req, res) => {
  try {
    const materiais = await EstoqueMaterial.findAll({ include: [{ model: Material, as: 'materialPai' }] });
    res.json({ success: true, materiais });
  } catch (err) {
    console.error('[ESTOQUE-MATERIAIS][ERRO]', err);
    res.status(500).json({ success: false, error: 'Falha ao buscar estoque de materiais', message: err.message });
  }
};

export const updateEstoqueMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantidade } = req.body;
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'ID do estoque inválido' });
    if (quantidade < 0) return res.status(400).json({ success: false, error: 'Quantidade não pode ser negativa' });

    const estoque = await EstoqueMaterial.findByPk(id);
    if (!estoque) return res.status(404).json({ success: false, error: 'Estoque de material não encontrado' });

    estoque.quantidade = quantidade;
    await estoque.save();
    console.log(`[UPDATE-ESTOQUE-MATERIAIS] ID ${id} atualizado -> quantidade=${quantidade}`);
    res.json({ success: true, estoque });
  } catch (err) {
    console.error('[UPDATE-ESTOQUE-MATERIAIS][ERRO]', err);
    res.status(500).json({ success: false, error: 'Falha ao atualizar estoque de material', message: err.message });
  }
};

export const getEstoqueProdutos = async (req, res) => {
  try {
    const produtos = await EstoqueProduto.findAll({
      include: [{ model: ProdutoTamanho, as: 'produtoTamanhoPai', include: [{ model: Produto, as: 'produtoPai' }] }]
    });
    res.json({ success: true, produtos });
  } catch (err) {
    console.error('[ESTOQUE-PRODUTOS][ERRO]', err);
    res.status(500).json({ success: false, error: 'Falha ao buscar estoque de produtos', message: err.message });
  }
};

export const updateEstoqueProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantidadeAberta, quantidadePronta } = req.body;
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'ID do estoque inválido' });
    if (quantidadeAberta < 0 || quantidadePronta < 0) return res.status(400).json({ success: false, error: 'Quantidade não pode ser negativa' });

    const estoque = await EstoqueProduto.findByPk(id);
    if (!estoque) return res.status(404).json({ success: false, error: 'Estoque de produto não encontrado' });

    estoque.quantidadeAberta = quantidadeAberta;
    estoque.quantidadePronta = quantidadePronta;
    await estoque.save();
    console.log(`[UPDATE-ESTOQUE-PRODUTOS] ID ${id} atualizado -> aberta=${quantidadeAberta}, pronta=${quantidadePronta}`);
    res.json({ success: true, estoque });
  } catch (err) {
    console.error('[UPDATE-ESTOQUE-PRODUTOS][ERRO]', err);
    res.status(500).json({ success: false, error: 'Falha ao atualizar estoque de produto', message: err.message });
  }
};

export const verificarEstoque = async (req, res) => {
  try {
    const estoques = await EstoqueProduto.findAll({
      include: [{ model: ProdutoTamanho, as: 'produtoTamanhoPai', include: [{ model: Produto, as: 'produtoPai' }] }],
      where: { [Op.or]: [{ quantidadeAberta: { [Op.gt]: 0 } }, { quantidadePronta: { [Op.gt]: 0 } }] },
      order: [['produtoTamanhoPai', 'produtoPai', 'id', 'ASC'], ['produtoTamanhoPai', 'tamanho', 'ASC']]
    });

    const resumo = {
      totalItens: estoques.length,
      totalPecasAbertas: estoques.reduce((sum, e) => sum + Number(e.quantidadeAberta), 0),
      totalPecasProntas: estoques.reduce((sum, e) => sum + Number(e.quantidadePronta), 0)
    };

    console.log(`[VERIFICAR-ESTOQUE] totalItens=${resumo.totalItens}, abertas=${resumo.totalPecasAbertas}, prontas=${resumo.totalPecasProntas}`);
    res.json({ success: true, resumo, estoques });
  } catch (error) {
    console.error('[VERIFICAR-ESTOQUE][ERRO]', error);
    res.status(500).json({ success: false, error: 'Falha ao verificar estoque', message: error.message });
  }
};
