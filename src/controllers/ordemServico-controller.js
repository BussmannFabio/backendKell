// src/controllers/ordemServico-controller.js
import {
  OrdemServico, OrdemItem, Produto, ProdutoTamanho, EstoqueProduto,
  Financeiro, EstoqueMaterial, Material, Confeccao, sequelize
} from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Helper: resolve produto aceitando tanto id (PK) quanto codigo.
 * Retorna a instância do Produto ou null.
 */
async function resolveProduto(produtoIdOrCodigo, transaction = null) {
  if (produtoIdOrCodigo == null) return null;

  // tentar buscar por PK (número)
  const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
  if (byPk) return byPk;

  // fallback: buscar por codigo (string)
  const codigo = String(produtoIdOrCodigo);
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
        const tamanho = itemRaw.tamanho;

        if (!itemRaw.produtoId || !tamanho || !volumes || !pecasPorVolume) {
          console.warn('[CRIA-OS][ITEM][SKIP] dados incompletos', itemRawLog);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Dados incompletos' });
          continue;
        }

        // Resolve o produto (aceita id PK ou codigo)
        const produto = await resolveProduto(itemRaw.produtoId, t);
        if (!produto) {
          console.error('[CRIA-OS][ERRO] Produto não encontrado para valor:', itemRaw.produtoId);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Produto não encontrado' });
          continue;
        }

        // Verifica se existe ProdutoTamanho para este produto.id e tamanho
        const produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: produto.id, tamanho },
          transaction: t
        });

        if (!produtoTamanho) {
          console.error('[CRIA-OS][ERRO] ProdutoTamanho não encontrado', { produtoId: produto.id, tamanho });
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Tamanho do produto não encontrado' });
          continue;
        }

        // Calcular peças esperadas
        const pecasEsperadas = volumes * pecasPorVolume;

        // Criar OrdemItem usando produto.id (PK) para consistência
        const ordemItem = await OrdemItem.create({
          ordemId: ordem.id,
          produtoId: produto.id, // <--- **use o PK do produto**
          tamanho,
          volumes,
          pecasPorVolume,
          pecasEsperadas,
          corte: itemRaw.corte ? String(itemRaw.corte) : null
        }, { transaction: t });
        console.log('[CRIA-OS] OrdemItem criada ID=', ordemItem.id);

        // Atualiza ou cria EstoqueProduto
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

        resultados.push({ item: itemRawLog, status: 'ok', pecasEsperadas });

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

// ---------------------- RETORNAR ORDEM (VERSÃO CORRIGIDA) ----------------------
export const retornarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];
    const retornoTotal = req.body.retornoTotal === true;
    console.log('[RETORNO-OS][INICIO]', { id, itensRecebidosCount: itensRecebidos.length, retornoTotal });

    const ordem = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'], transaction: t });
    if (!ordem) {
      await t.rollback();
      return res.status(404).json({ success: false, error: 'OS não encontrada' });
    }
    if (ordem.status === 'RETORNADA') {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'OS já retornada' });
    }

    const resultados = [];
    let totalRestanteDepois = 0;

    for (const item of ordem.itens) {
      try {
        // encontra correspondência do front (por id ou por produto+tamanho)
        const frontendItem = itensRecebidos.find(i =>
          (i.id && String(i.id) === String(item.id)) ||
          (i.produtoId && String(i.produtoId) === String(item.produtoId) && String(i.tamanho) === String(item.tamanho))
        );

        const pecasDigitadas = frontendItem ? Number(frontendItem.pecasRetornadas || 0) : 0;
        const pecasEsperadasAntes = Number(item.pecasEsperadas || 0);

        // pecas que efetivamente irão para "pronta" nesta chamada: sempre baseado no input (limite: esperado)
        const pecasParaPronta = Math.min(Math.max(pecasDigitadas, 0), pecasEsperadasAntes);

        // quanto vamos reduzir de "aberta" no estoque:
        // - se retornoTotal: devemos remover toda a pendência registrada pela OS (pecasEsperadasAntes)
        // - se parcial: removemos apenas as peças que foram efetivamente movidas para pronta (pecasParaPronta)
        const reduzirAberta = retornoTotal ? pecasEsperadasAntes : pecasParaPronta;

        // após operação, quantas peças ficam pendentes na OS
        const pecasRestantesNaOS = retornoTotal ? 0 : Math.max(pecasEsperadasAntes - pecasParaPronta, 0);

        console.log('[RETORNO-OS] itemId=', item.id,
          'digitadas=', pecasDigitadas,
          'paraPronta=', pecasParaPronta,
          'reduzirAberta=', reduzirAberta,
          'restantesNaOS=', pecasRestantesNaOS
        );

        // localizar ProdutoTamanho (fallback via resolveProduto)
        let produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: item.produtoId, tamanho: item.tamanho },
          transaction: t
        });
        if (!produtoTamanho) {
          const produtoResolve = await resolveProduto(item.produtoId, t);
          if (produtoResolve) {
            produtoTamanho = await ProdutoTamanho.findOne({
              where: { produtoId: produtoResolve.id, tamanho: item.tamanho },
              transaction: t
            });
          }
        }
        if (!produtoTamanho) {
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'ProdutoTamanho não encontrado' });
          continue;
        }

        // atualiza ou cria estoque:
        // - subtrai "reduzirAberta" de quantidadeAberta
        // - soma "pecasParaPronta" em quantidadePronta
        let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction: t });
        if (!estoque) {
          // se não existe estoque, criamos com base no que fizer sentido localmente:
          const abertaInicial = retornoTotal ? 0 : Math.max(0, pecasEsperadasAntes - pecasParaPronta);
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

        // financeiro só sobre as peças que efetivamente foram finalizadas agora
        const produtoForCalc = await Produto.findByPk(item.produtoId, { transaction: t });
        const duzias = pecasParaPronta / 12;
        const valorMaoDeObra = produtoForCalc && produtoForCalc.valorMaoDeObraDuzia
          ? Number(produtoForCalc.valorMaoDeObraDuzia) * duzias
          : 0;

        const financeiro = await Financeiro.create({
          ordemId: ordem.id,
          confeccaoId: ordem.confeccaoId,
          valorMaoDeObra,
          diferenca: pecasParaPronta - pecasEsperadasAntes, // mantemos histórico (pode ser negativo)
          status: 'ABERTO'
        }, { transaction: t });

        totalRestanteDepois += pecasRestantesNaOS;
        resultados.push({ itemId: item.id, status: 'ok', pecasParaPronta, reduzirAberta, estoqueId: estoque.id, financeiroId: financeiro.id });

      } catch (itemError) {
        console.error('[RETORNO-OS][ERRO][ITEM]', item.id, itemError);
        resultados.push({ itemId: item.id, status: 'erro', mensagem: itemError.message });
      }
    }

    // define status da OS com base no total restante
    if (totalRestanteDepois > 0) {
      // ficou restante → coloca em produção (há peças em espera)
      await ordem.update({ status: 'EM_PRODUCAO', dataRetorno: null }, { transaction: t });
    } else {
      // tudo retornado ou descartado → marca como retornada e grava dataRetorno
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

    // permitir reabrir se estiver RETORNADA ou EM_PRODUCAO (parcialmente retornada)
    if (!['RETORNADA', 'EM_PRODUCAO'].includes(ordem.status)) {
      await t.rollback();
      return res.status(400).json({ success: false, error: 'Somente OS retornadas ou em produção podem ser reabertas' });
    }

    // Atualiza status para CRIADA (reaberta) e limpa dataRetorno
    await ordem.update({ status: 'CRIADA', dataRetorno: null }, { transaction: t });
    console.log('[REABRIR-OS] status setado para CRIADA id=', id);

    const resultados = [];

    for (const item of ordem.itens) {
      try {
        const pecasReais = Number(item.pecasReais || 0);
        // Se não houver peças reais registradas (nada finalizado para esse item), pula
        if (pecasReais <= 0) {
          resultados.push({ itemId: item.id, status: 'ok', mensagem: 'Nenhuma peça pronta para reverter', pecasRevertidas: 0 });
          continue;
        }

        // localizar ProdutoTamanho
        const produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: item.produtoId, tamanho: item.tamanho },
          transaction: t
        });

        if (!produtoTamanho) {
          console.warn('[REABRIR-OS][AVISO] ProdutoTamanho não encontrado para item', item.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'ProdutoTamanho não encontrado', pecasRevertidas: 0 });
          continue;
        }

        // localizar EstoqueProduto
        const estoque = await EstoqueProduto.findOne({
          where: { produtoTamanhoId: produtoTamanho.id },
          transaction: t
        });

        if (!estoque) {
          console.warn('[REABRIR-OS][AVISO] EstoqueProduto não encontrado para produtoTamanhoId', produtoTamanho.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'Estoque não encontrado', pecasRevertidas: 0 });
          continue;
        }

        // Reverter estoque: tirar das prontas e adicionar às abertas
        const prontaAntes = Number(estoque.quantidadePronta || 0);
        const abertaAntes = Number(estoque.quantidadeAberta || 0);

        const retirar = Math.min(prontaAntes, pecasReais); // garante que não fique negativo
        estoque.quantidadePronta = Math.max(prontaAntes - retirar, 0);
        estoque.quantidadeAberta = abertaAntes + retirar;
        await estoque.save({ transaction: t });

        // Atualiza o item: restaura pecasEsperadas e zera pecasReais
        item.pecasEsperadas = Number(item.pecasEsperadas || 0) + retirar;
        item.pecasReais = Math.max(pecasReais - retirar, 0); // se houve inconsistência, mantém o que sobrou (normalmente 0)
        await item.save({ transaction: t });

        resultados.push({ itemId: item.id, status: 'ok', pecasRevertidas: retirar, estoqueId: estoque.id });

      } catch (errItem) {
        console.error('[REABRIR-OS][ERRO][ITEM]', item.id, errItem);
        resultados.push({ itemId: item.id, status: 'erro', mensagem: errItem.message });
      }
    }

    // Remove lançamentos financeiros relacionados à ordem (mesmo comportamento anterior)
    try {
      await Financeiro.destroy({ where: { ordemId: ordem.id, confeccaoId: ordem.confeccaoId }, transaction: t });
      console.log('[REABRIR-OS][FINANCEIRO] lançamentos removidos ordemId=', ordem.id);
    } catch (errFin) {
      console.error('[REABRIR-OS][ERRO][FINANCEIRO] ao remover lançamentos', errFin);
      // não falhará todo o processo só por uma falha pontual aqui — mas logamos e seguimos
    }

    await t.commit();

    // Recarrega ordem atualizada para resposta
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
    // Retornamos wrapper compatível com frontend (response.ordem)
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
      const produtoTamanho = await ProdutoTamanho.findOne({ where: { produtoId: item.produtoId, tamanho: item.tamanho }, transaction: t });
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

