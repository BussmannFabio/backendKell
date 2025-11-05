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

/**
 * Helper: resolve produto aceitando tanto id (PK) quanto codigo.
 * Retorna a instância do Produto ou null.
 */
async function resolveProduto(produtoIdOrCodigo, transaction = null) {
  if (produtoIdOrCodigo == null) return null;

  const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
  if (byPk) return byPk;

  const codigo = String(produtoIdOrCodigo).trim();
  if (!codigo) return null;
  const byCodigo = await Produto.findOne({ where: { codigo }, transaction });
  return byCodigo;
}

// ---------------------- CRIAR ORDEM ----------------------
export const criarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { itens, dataInicio, confeccaoId } = req.body;
    console.log('[CRIA-OS][INICIO]', { itensCount: (itens || []).length, dataInicio, confeccaoId });

    if (!confeccaoId) {
      console.warn('[CRIA-OS][VALIDACAO] confeccaoId faltando');
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'confeccaoId é obrigatório' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      console.warn('[CRIA-OS][VALIDACAO] itens faltando');
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Itens da ordem são obrigatórios' });
    }

    const dataInicioNorm = formatDateToYYYYMMDD(dataInicio);

    const ordem = await OrdemServico.create({ status: 'CRIADA', dataInicio: dataInicioNorm, confeccaoId }, { transaction });
    console.log('[CRIA-OS] OS criada com ID=', ordem.id);

    const resultados = [];

    for (const itemRaw of itens) {
      try {
        const itemRawLog = { ...itemRaw };
        const volumes = Number(itemRaw.volumes || 0);
        const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
        const produtoIdOrCodigo = itemRaw.produtoId;
        const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

        if (!produtoIdOrCodigo || !tamanhoRaw || volumes <= 0 || pecasPorVolume <= 0) {
          console.warn('[CRIA-OS][ITEM][SKIP] dados incompletos', itemRawLog);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Dados incompletos' });
          continue;
        }

        const produto = await resolveProduto(produtoIdOrCodigo, transaction);
        if (!produto) {
          console.error('[CRIA-OS][ERRO] Produto não encontrado para valor:', produtoIdOrCodigo);
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Produto não encontrado' });
          continue;
        }

        let produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: produto.id, tamanho: tamanhoRaw },
          transaction
        });

        if (!produtoTamanho) {
          produtoTamanho = await ProdutoTamanho.findOne({
            where: {
              produtoId: produto.id,
              [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoRaw)
            },
            transaction
          });
        }

        if (!produtoTamanho) {
          console.error('[CRIA-OS][ERRO] ProdutoTamanho não encontrado', { produtoId: produto.id, tamanho: tamanhoRaw });
          resultados.push({ item: itemRawLog, status: 'erro', mensagem: 'Tamanho do produto não encontrado' });
          continue;
        }

        const pecasEsperadas = volumes * pecasPorVolume;

        const ordemItem = await OrdemItem.create({
          ordemId: ordem.id,
          produtoId: produto.id,
          produtoTamanhoId: produtoTamanho.id,
          tamanho: tamanhoRaw,
          volumes: volumes,
          pecasPorVolume: pecasPorVolume,
          pecasEsperadas: pecasEsperadas,
          corte: itemRaw.corte ? String(itemRaw.corte) : null
        }, { transaction });
        console.log('[CRIA-OS] OrdemItem criada ID=', ordemItem.id, { produtoTamanhoId: produtoTamanho.id });

        let estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction });

        if (!estoque) {
          estoque = await EstoqueProduto.create({
            produtoTamanhoId: produtoTamanho.id,
            quantidadeAberta: pecasEsperadas,
            quantidadePronta: 0
          }, { transaction });
          console.log('[CRIA-OS][ESTOQUE] Novo estoque criado', {
            produtoTamanhoId: produtoTamanho.id,
            aberta: estoque.quantidadeAberta,
            pronta: estoque.quantidadePronta
          });
        } else {
          const abertaExistente = Number(estoque.quantidadeAberta || 0);
          estoque.quantidadeAberta = abertaExistente + pecasEsperadas;
          await estoque.save({ transaction });
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

    await transaction.commit();
    console.log('[CRIA-OS][SUCESSO] OS', ordem.id, 'criada');

    const ordemCompleta = await OrdemServico.findByPk(ordem.id, { include: ['itens', 'confeccao'] });
    return res.status(201).json({ success: true, ordem: ordemCompleta, detalhesItens: resultados });

  } catch (error) {
    await transaction.rollback();
    console.error('[CRIA-OS][ERRO] Falha geral ao criar ordem', error);
    return res.status(500).json({ success: false, error: 'Falha ao criar ordem', message: error.message });
  }
};

// ---------------------- RETORNAR ORDEM ----------------------
export const retornarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    console.log('[RETORNO-ORDEM-SERVICO][INICIO]', {
      identificador: req.params.id,
      quantidadeItens: req.body.itens?.length || 0,
      retornoTotal: req.body.retornoTotal,
      fecharSemQuantidade: req.body.fecharSemQuantidade,
      pecasComDefeito: req.body.pecasComDefeito
    });

    const { id } = req.params;
    const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];
    const retornoTotal = req.body.retornoTotal === true;
    const fecharSemQuantidade = req.body.fecharSemQuantidade === true;
    const pecasComDefeitoTotal = Number(req.body.pecasComDefeito || 0);

    if (!Number.isFinite(pecasComDefeitoTotal) || pecasComDefeitoTotal < 0) {
      await transaction.rollback();
      console.log('[RETORNO-ORDEM-SERVICO][ERRO] pecasComDefeito inválido');
      return res.status(400).json({ success: false, error: 'pecasComDefeito inválido' });
    }

    const ordemServico = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'], transaction });

    if (!ordemServico) {
      await transaction.rollback();
      console.log('[RETORNO-ORDEM-SERVICO][ERRO] Ordem de serviço não encontrada');
      return res.status(404).json({ success: false, error: 'Ordem de serviço não encontrada' });
    }

    if (ordemServico.status === 'RETORNADA') {
      await transaction.rollback();
      console.log('[RETORNO-ORDEM-SERVICO][ERRO] Ordem de serviço já retornada');
      return res.status(400).json({ success: false, error: 'Ordem de serviço já retornada' });
    }

    const totalPecasPendentes = ordemServico.itens.reduce((soma, item) => soma + Number(item.pecasEsperadas || 0), 0);
    let totalPecasDigitadas = 0;

    if (itensRecebidos.length > 0) {
      totalPecasDigitadas = itensRecebidos.reduce((soma, item) => soma + Number(item.pecasRetornadas || 0), 0);
    } else if (retornoTotal && !fecharSemQuantidade) {
      totalPecasDigitadas = totalPecasPendentes;
    }

    const maximoPermitidoDefeitos = (fecharSemQuantidade && itensRecebidos.length === 0)
      ? totalPecasPendentes
      : (retornoTotal && itensRecebidos.length === 0 ? totalPecasPendentes : totalPecasDigitadas);

    if (pecasComDefeitoTotal > maximoPermitidoDefeitos) {
      await transaction.rollback();
      console.log('[RETORNO-ORDEM-SERVICO][ERRO] Defeitos excedem o máximo permitido', {
        pecasComDefeito: pecasComDefeitoTotal,
        maximoPermitido: maximoPermitidoDefeitos
      });
      return res.status(400).json({ success: false, error: 'Defeitos excedem o máximo permitido' });
    }

    const resultadosProcessamento = [];
    let totalPecasRestantesDepois = 0;

    for (const itemOrdem of ordemServico.itens) {
      const itemFrontendCorrespondente = itensRecebidos.find(itemFrontend =>
        (itemFrontend.id && String(itemFrontend.id) === String(itemOrdem.id)) ||
        (itemFrontend.produtoId && String(itemFrontend.produtoId) === String(itemOrdem.produtoId) &&
          String(itemFrontend.tamanho).trim().toUpperCase() === String(itemOrdem.tamanho).trim().toUpperCase())
      );

      const pecasEsperadasAntesProcessamento = Number(itemOrdem.pecasEsperadas || 0);

      let pecasRetornadasDigitadas = 0;
      if (itensRecebidos.length > 0) {
        pecasRetornadasDigitadas = Number(itemFrontendCorrespondente ? (itemFrontendCorrespondente.pecasRetornadas || 0) : 0);
      } else if (retornoTotal && !fecharSemQuantidade) {
        pecasRetornadasDigitadas = pecasEsperadasAntesProcessamento;
      }

      const defeitosAlocadosItem = itemFrontendCorrespondente ? Math.min(
        Number(itemFrontendCorrespondente.pecasComDefeito || 0),
        pecasRetornadasDigitadas
      ) : 0;

      const pecasBoaQualidadeParaEstoque = Math.min(
        Math.max(pecasRetornadasDigitadas - defeitosAlocadosItem, 0),
        pecasEsperadasAntesProcessamento
      );

      const reducaoQuantidadeAbertaOrdem = (retornoTotal || fecharSemQuantidade)
        ? pecasEsperadasAntesProcessamento
        : Math.min(
            Math.max(pecasRetornadasDigitadas + defeitosAlocadosItem, 0),
            pecasEsperadasAntesProcessamento
          );

      const pecasRestantesNaOrdem = Math.max(0, pecasEsperadasAntesProcessamento - reducaoQuantidadeAbertaOrdem);

      console.log('[RETORNO-ORDEM-SERVICO][ITEM-PROCESSADO]', {
        identificadorItem: itemOrdem.id,
        tamanhoProduto: itemOrdem.tamanho,
        pecasEsperadasInicial: pecasEsperadasAntesProcessamento,
        pecasRetornadasInformadas: pecasRetornadasDigitadas,
        defeitosAlocados: defeitosAlocadosItem,
        pecasBoaQualidade: pecasBoaQualidadeParaEstoque,
        pecasRestantesOrdem: pecasRestantesNaOrdem,
        reducaoQuantidadeAberta: reducaoQuantidadeAbertaOrdem
      });

      const tamanhoNormalizado = String(itemOrdem.tamanho || '').trim().toUpperCase();

      let produtoTamanhoEncontrado = null;

      if (itemFrontendCorrespondente?.produtoTamanhoId) {
        produtoTamanhoEncontrado = await ProdutoTamanho.findOne({
          where: {
            id: itemFrontendCorrespondente.produtoTamanhoId,
            produtoId: itemOrdem.produtoId
          },
          transaction
        });
      }

      if (!produtoTamanhoEncontrado) {
        produtoTamanhoEncontrado = await ProdutoTamanho.findOne({
          where: {
            produtoId: itemOrdem.produtoId,
            tamanho: tamanhoNormalizado
          },
          transaction
        });
      }

      if (!produtoTamanhoEncontrado) {
        produtoTamanhoEncontrado = await ProdutoTamanho.findOne({
          where: {
            produtoId: itemOrdem.produtoId,
            [Op.and]: sequelize.where(
              fn('LOWER', col('tamanho')),
              Op.eq,
              tamanhoNormalizado.toLowerCase()
            )
          },
          transaction
        });
      }

      if (!produtoTamanhoEncontrado) {
        console.error('[RETORNO-ORDEM-SERVICO][ERRO] ProdutoTamanho não encontrado para:', {
          produtoId: itemOrdem.produtoId,
          tamanho: tamanhoNormalizado,
          identificadorItem: itemOrdem.id
        });

        resultadosProcessamento.push({
          identificadorItem: itemOrdem.id,
          status: 'erro',
          mensagem: `ProdutoTamanho não encontrado para produto ${itemOrdem.produtoId} tamanho ${tamanhoNormalizado}`
        });
        continue;
      }

      console.log('[RETORNO-ORDEM-SERVICO] ProdutoTamanho encontrado:', {
        identificadorItem: itemOrdem.id,
        produtoId: itemOrdem.produtoId,
        tamanho: tamanhoNormalizado,
        produtoTamanhoId: produtoTamanhoEncontrado.id
      });

      let estoqueProduto = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanhoEncontrado.id }, transaction });

      if (!estoqueProduto) {
        estoqueProduto = await EstoqueProduto.create({
          produtoTamanhoId: produtoTamanhoEncontrado.id,
          quantidadeAberta: Math.max(0, pecasEsperadasAntesProcessamento - reducaoQuantidadeAbertaOrdem),
          quantidadePronta: pecasBoaQualidadeParaEstoque
        }, { transaction });

        console.log('[RETORNO-ORDEM-SERVICO][ESTOQUE] Novo estoque criado', {
          produtoTamanhoId: produtoTamanhoEncontrado.id,
          tamanho: tamanhoNormalizado,
          quantidadeAberta: estoqueProduto.quantidadeAberta,
          quantidadePronta: estoqueProduto.quantidadePronta
        });
      } else {
        estoqueProduto.quantidadeAberta = Math.max(Number(estoqueProduto.quantidadeAberta || 0) - reducaoQuantidadeAbertaOrdem, 0);
        estoqueProduto.quantidadePronta = Number(estoqueProduto.quantidadePronta || 0) + pecasBoaQualidadeParaEstoque;
        await estoqueProduto.save({ transaction });

        console.log('[RETORNO-ORDEM-SERVICO][ESTOQUE] Estoque atualizado', {
          produtoTamanhoId: produtoTamanhoEncontrado.id,
          tamanho: tamanhoNormalizado,
          quantidadeAberta: estoqueProduto.quantidadeAberta,
          quantidadePronta: estoqueProduto.quantidadePronta
        });
      }

      itemOrdem.pecasReais = Number(itemOrdem.pecasReais || 0) + pecasBoaQualidadeParaEstoque;
      itemOrdem.pecasDefeituosas = Number(itemOrdem.pecasDefeituosas || 0) + defeitosAlocadosItem;
      itemOrdem.pecasEsperadas = pecasRestantesNaOrdem;
      await itemOrdem.save({ transaction });

      const produtoParaCalculoFinanceiro = await Produto.findByPk(itemOrdem.produtoId, { transaction });
      const valorUnitarioMaoDeObra = (produtoParaCalculoFinanceiro?.valorMaoDeObraDuzia || 0) / 12;
      const valorPorPecaMaoDeObra = produtoParaCalculoFinanceiro?.valorMaoDeObraPeca || 0;

      const toleranciaPecas = Math.floor(pecasEsperadasAntesProcessamento * 0.02);
      const limiteMinimoPecas = pecasEsperadasAntesProcessamento - toleranciaPecas;

      const totalPecasPagas = pecasBoaQualidadeParaEstoque + defeitosAlocadosItem;
      const diferencaPecas = totalPecasPagas - limiteMinimoPecas;

      const baseCalculoDuzia = Math.max(0, limiteMinimoPecas);
      const valorTotalMaoDeObra = baseCalculoDuzia * valorUnitarioMaoDeObra + (diferencaPecas * valorPorPecaMaoDeObra);

      console.log('[RETORNO-ORDEM-SERVICO][CALCULO-FINANCEIRO]', {
        identificadorItem: itemOrdem.id,
        pecasEsperadasInicial: pecasEsperadasAntesProcessamento,
        tolerancia: toleranciaPecas,
        limiteMinimo: limiteMinimoPecas,
        totalPecasPagas: totalPecasPagas,
        baseCalculoDuzia: baseCalculoDuzia,
        diferenca: diferencaPecas,
        valorUnitario: valorUnitarioMaoDeObra,
        valorPorPeca: valorPorPecaMaoDeObra,
        valorTotalMaoDeObra: valorTotalMaoDeObra
      });

      const registroFinanceiro = await Financeiro.create({
        ordemId: ordemServico.id,
        confeccaoId: ordemServico.confeccaoId,
        valorMaoDeObra: valorTotalMaoDeObra,
        pecasProduzidas: totalPecasPagas,
        status: 'ABERTO'
      }, { transaction });

      totalPecasRestantesDepois += pecasRestantesNaOrdem;

      resultadosProcessamento.push({
        identificadorItem: itemOrdem.id,
        pecasBoaQualidade: pecasBoaQualidadeParaEstoque,
        pecasComDefeito: defeitosAlocadosItem,
        totalPecasPagas: totalPecasPagas,
        valorMaoDeObra: valorTotalMaoDeObra,
        identificadorFinanceiro: registroFinanceiro.id,
        status: 'sucesso'
      });
    }

    const now = new Date();
    const dataRetornoStr = formatDateToYYYYMMDD(now);

    if (totalPecasRestantesDepois > 0) {
      await ordemServico.update({ status: 'EM_PRODUCAO', dataRetorno: null }, { transaction });
      console.log('[RETORNO-ORDEM-SERVICO][STATUS] EM_PRODUCAO', { totalPecasRestantes: totalPecasRestantesDepois });
    } else {
      await ordemServico.update({ status: 'RETORNADA', dataRetorno: dataRetornoStr }, { transaction });
      console.log('[RETORNO-ORDEM-SERVICO][STATUS] RETORNADA', { dataRetorno: dataRetornoStr });
    }

    await transaction.commit();
    const ordemServicoAtualizada = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'] });

    console.log('[RETORNO-ORDEM-SERVICO][FIM] Processamento concluído com sucesso');
    return res.json({ success: true, ordem: ordemServicoAtualizada, detalhesItens: resultadosProcessamento });

  } catch (erro) {
    await transaction.rollback();
    console.error('[RETORNO-ORDEM-SERVICO][ERRO] Falha no processamento', erro);
    return res.status(500).json({ success: false, error: 'Falha interna no servidor ao processar retorno da ordem de serviço', message: erro.message });
  }
};

// ---------------------- REABRIR ORDEM ----------------------
export const reabrirOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    console.log('[REABRIR-OS][INICIO] id=', id);

    const ordem = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'], transaction });
    if (!ordem) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'OS não encontrada' });
    }

    if (!['RETORNADA', 'EM_PRODUCAO'].includes(ordem.status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Somente OS retornadas ou em produção podem ser reabertas' });
    }

    await ordem.update({ status: 'CRIADA', dataRetorno: null }, { transaction });
    console.log('[REABRIR-OS] status setado para CRIADA id=', id);

    const resultados = [];

    for (const item of ordem.itens) {
      try {
        const pecasReais = Number(item.pecasReais || 0);
        if (pecasReais <= 0) {
          resultados.push({ itemId: item.id, status: 'ok', mensagem: 'Nenhuma peça pronta para reverter', pecasRevertidas: 0 });
          continue;
        }

        const tamanhoNormalizado = String(item.tamanho || '').trim().toUpperCase();

        const produtoTamanho = await ProdutoTamanho.findOne({
          where: { produtoId: item.produtoId, [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoNormalizado) },
          transaction
        });

        if (!produtoTamanho) {
          console.warn('[REABRIR-OS][AVISO] ProdutoTamanho não encontrado para item', item.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'ProdutoTamanho não encontrado', pecasRevertidas: 0 });
          continue;
        }

        const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction });
        if (!estoque) {
          console.warn('[REABRIR-OS][AVISO] EstoqueProduto não encontrado para produtoTamanhoId', produtoTamanho.id);
          resultados.push({ itemId: item.id, status: 'erro', mensagem: 'Estoque não encontrado', pecasRevertidas: 0 });
          continue;
        }

        const prontaAntes = Number(estoque.quantidadePronta || 0);
        const abertaAntes = Number(estoque.quantidadeAberta || 0);

        const retirar = Math.min(prontaAntes, pecasReais);
        estoque.quantidadePronta = Math.max(prontaAntes - retirar, 0);
        estoque.quantidadeAberta = abertaAntes + retirar;
        await estoque.save({ transaction });

        item.pecasEsperadas = Number(item.pecasEsperadas || 0) + retirar;
        item.pecasReais = Math.max(pecasReais - retirar, 0);
        await item.save({ transaction });

        resultados.push({ itemId: item.id, status: 'ok', pecasRevertidas: retirar, estoqueId: estoque.id });

      } catch (erroItem) {
        console.error('[REABRIR-OS][ERRO][ITEM]', item.id, erroItem);
        resultados.push({ itemId: item.id, status: 'erro', mensagem: erroItem.message });
      }
    }

    try {
      await Financeiro.destroy({ where: { ordemId: ordem.id, confeccaoId: ordem.confeccaoId }, transaction });
      console.log('[REABRIR-OS][FINANCEIRO] lançamentos removidos ordemId=', ordem.id);
    } catch (erroFinanceiro) {
      console.error('[REABRIR-OS][ERRO][FINANCEIRO] ao remover lançamentos', erroFinanceiro);
    }

    await transaction.commit();

    const ordemAtualizada = await OrdemServico.findByPk(id, { include: ['itens', 'confeccao'] });
    console.log('[REABRIR-OS][SUCESSO] ordem reaberta id=', id);

    return res.json({ success: true, ordem: ordemAtualizada, detalhesItens: resultados });

  } catch (error) {
    await transaction.rollback();
    console.error('[REABRIR-OS][ERRO] Falha geral', error);
    return res.status(500).json({ success: false, error: 'Falha ao reabrir ordem', message: error.message });
  }
};

// ---------------------- LISTAR ORDENS ----------------------
export const listarOrdens = async (req, res) => {
  try {
    const ordens = await OrdemServico.findAll({ include: ['itens', 'confeccao'] });
    return res.json({ success: true, ordens });
  } catch (error) {
    console.error('[LISTAR-OS][ERRO]', error);
    return res.status(500).json({ success: false, error: 'Falha ao listar ordens', message: error.message });
  }
};

// ---------------------- BUSCAR ORDEM POR ID ----------------------
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
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const ordem = await OrdemServico.findByPk(id, { include: ['itens'], transaction });
    if (!ordem) return res.status(404).json({ success: false, error: 'Ordem não encontrada' });

    for (const item of ordem.itens) {
      const tamanhoNormalizado = String(item.tamanho || '').trim().toUpperCase();
      const produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: item.produtoId, [Op.and]: sequelize.where(fn('upper', col('tamanho')), tamanhoNormalizado) },
        transaction
      });
      if (!produtoTamanho) continue;

      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: produtoTamanho.id }, transaction });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta || 0) - (item.pecasEsperadas || 0), 0);
        estoque.quantidadePronta = Math.max(Number(estoque.quantidadePronta || 0) - (item.pecasReais || 0), 0);
        await estoque.save({ transaction });
      }
      await item.destroy({ transaction });
    }

    await Financeiro.destroy({ where: { ordemId: ordem.id }, transaction });
    await ordem.destroy({ transaction });
    await transaction.commit();

    console.log('[DELETAR-OS] Ordem', id, 'deletada com sucesso');
    return res.json({ success: true, message: 'Ordem de serviço excluída com sucesso!' });

  } catch (error) {
    await transaction.rollback();
    console.error('[DELETAR-OS][ERRO]', error);
    return res.status(500).json({ success: false, error: 'Falha ao deletar ordem', message: error.message });
  }
};

// ---------------------- ESTOQUE / FINANCEIRO ----------------------
export const getEstoqueMateriais = async (req, res) => {
  try {
    const materiais = await EstoqueMaterial.findAll({ include: [{ model: Material, as: 'materialPai' }] });
    res.json({ success: true, materiais });
  } catch (erro) {
    console.error('[ESTOQUE-MATERIAIS][ERRO]', erro);
    res.status(500).json({ success: false, error: 'Falha ao buscar estoque de materiais', message: erro.message });
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
  } catch (erro) {
    console.error('[UPDATE-ESTOQUE-MATERIAIS][ERRO]', erro);
    res.status(500).json({ success: false, error: 'Falha ao atualizar estoque de material', message: erro.message });
  }
};

export const getEstoqueProdutos = async (req, res) => {
  try {
    const produtos = await EstoqueProduto.findAll({
      include: [{ model: ProdutoTamanho, as: 'produtoTamanhoPai', include: [{ model: Produto, as: 'produtoPai' }] }]
    });
    res.json({ success: true, produtos });
  } catch (erro) {
    console.error('[ESTOQUE-PRODUTOS][ERRO]', erro);
    res.status(500).json({ success: false, error: 'Falha ao buscar estoque de produtos', message: erro.message });
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
  } catch (erro) {
    console.error('[UPDATE-ESTOQUE-PRODUTOS][ERRO]', erro);
    res.status(500).json({ success: false, error: 'Falha ao atualizar estoque de produto', message: erro.message });
  }
};

export const verificarEstoque = async (req, res) => {
  try {
    const estoques = await EstoqueProduto.findAll({
      include: [{ model: ProdutoTamanho, as: 'produtoTamanhoPai', include: [{ model: Produto, as: 'produtoPai' }] }],
      where: { [Op.or]: [{ quantidadeAberta: { [Op.gt]: 0 } }, { quantidadePronta: { [Op.gt]: 0 } }] },
      order: [[{ model: ProdutoTamanho, as: 'produtoTamanhoPai' }, { model: Produto, as: 'produtoPai' }, 'id', 'ASC'], [{ model: ProdutoTamanho, as: 'produtoTamanhoPai' }, 'tamanho', 'ASC']]
    });

    const resumo = {
      totalItens: estoques.length,
      totalPecasAbertas: estoques.reduce((soma, estoque) => soma + Number(estoque.quantidadeAberta || 0), 0),
      totalPecasProntas: estoques.reduce((soma, estoque) => soma + Number(estoque.quantidadePronta || 0), 0)
    };

    console.log(`[VERIFICAR-ESTOQUE] totalItens=${resumo.totalItens}, abertas=${resumo.totalPecasAbertas}, prontas=${resumo.totalPecasProntas}`);
    res.json({ success: true, resumo, estoques });
  } catch (error) {
    console.error('[VERIFICAR-ESTOQUE][ERRO]', error);
    res.status(500).json({ success: false, error: 'Falha ao verificar estoque', message: error.message });
  }
};
