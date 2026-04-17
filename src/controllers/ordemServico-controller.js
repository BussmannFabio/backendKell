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
  const codigoStr = String(produtoIdOrCodigo).trim();
  
  // 1. Tenta buscar primeiro pelo código exato do produto (o mais comum digitado pelo usuário)
  if (codigoStr) {
    const byCodigo = await Produto.findOne({ where: { codigo: codigoStr }, transaction });
    if (byCodigo) return byCodigo;
  }

  // 2. Se não encontrar por código, tenta buscar pelo ID interno (fallback de segurança)
  // Apenas se for um valor numérico válido
  if (!isNaN(Number(produtoIdOrCodigo))) {
    const byPk = await Produto.findByPk(produtoIdOrCodigo, { transaction });
    if (byPk) return byPk;
  }

  return null;
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
      await transaction.rollback();
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
    const resumoEstoque = {}; 

    for (const itemRaw of itens) {
      const volumes = Number(itemRaw.volumes || 0);
      const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
      const pecasEsperadas = volumes * pecasPorVolume;
      
      if (pecasEsperadas <= 0) continue;

      const produto = await resolveProduto(itemRaw.produtoId || itemRaw.produtoCodigo, transaction);
      const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

      if (!produto) {
        throw new Error(`Produto não encontrado (Ref: ${itemRaw.produtoCodigo || itemRaw.produtoId})`);
      }

      let produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: produto.id, tamanho: tamanhoRaw },
        transaction
      });

      if (!produtoTamanho) {
        produtoTamanho = await ProdutoTamanho.create({
          produtoId: produto.id,
          tamanho: tamanhoRaw,
          estoqueMinimo: 0
        }, { transaction });
      }

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

      const ptId = produtoTamanho.id;
      resumoEstoque[ptId] = (resumoEstoque[ptId] || 0) + pecasEsperadas;
    }

    const idsOrdenados = Object.keys(resumoEstoque).sort((a, b) => Number(a) - Number(b));
    for (const ptId of idsOrdenados) {
      const quantidadeAdicionar = resumoEstoque[ptId];
      let estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: ptId }, 
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!estoque) {
        await EstoqueProduto.create({
          produtoTamanhoId: ptId,
          quantidadeAberta: quantidadeAdicionar,
          quantidadePronta: 0
        }, { transaction });
      } else {
        await estoque.update({ 
          quantidadeAberta: Number(estoque.quantidadeAberta || 0) + quantidadeAdicionar 
        }, { transaction });
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

// ---------------------- EDITAR ORDEM (NOVA FUNÇÃO) ----------------------
export const editarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { itens, dataInicio, confeccaoId } = req.body;

    const ordem = await OrdemServico.findByPk(id, { 
      include: [{ model: OrdemItem, as: 'itens' }], 
      transaction 
    });

    if (!ordem) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
    }

    if (ordem.status !== 'CRIADA') {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Apenas ordens com status CRIADA podem ser editadas.' });
    }

    // 1. REVERTER IMPACTO NO ESTOQUE (Devolver o que estava "Aberto" para o estoque)
    for (const itemAntigo of ordem.itens) {
      const estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: itemAntigo.produtoTamanhoId }, 
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (estoque) {
        estoque.quantidadeAberta = Math.max(Number(estoque.quantidadeAberta) - Number(itemAntigo.pecasEsperadas), 0);
        await estoque.save({ transaction });
      }
    }

    // 2. LIMPAR ITENS ANTIGOS
    await OrdemItem.destroy({ where: { ordemId: id }, transaction });

    // 3. ATUALIZAR DADOS CABEÇALHO
    await ordem.update({
      dataInicio: formatDateToYYYYMMDD(dataInicio),
      confeccaoId
    }, { transaction });

    // 4. PROCESSAR NOVOS ITENS E ATUALIZAR ESTOQUE
    let somaTotalEsperada = 0;
    const resumoEstoque = {};

    for (const itemRaw of itens) {
      const volumes = Number(itemRaw.volumes || 0);
      const pecasPorVolume = Number(itemRaw.pecasPorVolume || 0);
      const pecasEsperadas = volumes * pecasPorVolume;
      if (pecasEsperadas <= 0) continue;

      const produto = await resolveProduto(itemRaw.produtoId || itemRaw.produtoCodigo, transaction);
      const tamanhoRaw = String(itemRaw.tamanho || '').trim().toUpperCase();

      if (!produto) {
        throw new Error(`Produto não encontrado (Ref: ${itemRaw.produtoCodigo || itemRaw.produtoId})`);
      }

      let produtoTamanho = await ProdutoTamanho.findOne({
        where: { produtoId: produto.id, tamanho: tamanhoRaw },
        transaction
      });

      if (!produtoTamanho) {
        produtoTamanho = await ProdutoTamanho.create({
          produtoId: produto.id,
          tamanho: tamanhoRaw,
          estoqueMinimo: 0
        }, { transaction });
      }

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

      const ptId = produtoTamanho.id;
      resumoEstoque[ptId] = (resumoEstoque[ptId] || 0) + pecasEsperadas;
    }

    // Atualização Atômica de Estoque
    const idsOrdenados = Object.keys(resumoEstoque).sort((a, b) => Number(a) - Number(b));
    for (const ptId of idsOrdenados) {
      let estoque = await EstoqueProduto.findOne({ 
        where: { produtoTamanhoId: ptId }, 
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!estoque) {
        await EstoqueProduto.create({ 
          produtoTamanhoId: ptId, 
          quantidadeAberta: resumoEstoque[ptId],
          quantidadePronta: 0 
        }, { transaction });
      } else {
        estoque.quantidadeAberta = Number(estoque.quantidadeAberta) + resumoEstoque[ptId];
        await estoque.save({ transaction });
      }
    }

    await ordem.update({ totalPecasEsperadas: somaTotalEsperada }, { transaction });

    await transaction.commit();
    return res.json({ success: true, message: 'Ordem de serviço atualizada com sucesso!' });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('[ORDEM][EDITAR] Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------- RETORNAR ORDEM ----------------------
export const retornarOrdem = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
      itens: itensRecebidos = [], 
      retornoTotal = false, 
      fecharSemQuantidade = false,
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

    let acumuladoRealFinalOS = 0;

    for (const itemOrdem of ordemServico.itens) {
      const itemFront = itensRecebidos.find(i => String(i.id) === String(itemOrdem.id));
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

      // Captura pecas ja retornadas ANTES de incrementar (necessario para calcular base vs excedente)
      const pecasJaRetornadas = Number(itemOrdem.pecasReais || 0);
      const pecasEstaRetornando = pecasBoas + defeitos;

      itemOrdem.pecasReais = pecasJaRetornadas + pecasBoas;
      itemOrdem.pecasDefeituosas = Number(itemOrdem.pecasDefeituosas || 0) + defeitos;

      if (retornoTotal || fecharSemQuantidade) {
        itemOrdem.pecasEsperadas = 0;
      } else {
        itemOrdem.pecasEsperadas = Math.max(pecasPendenteNoMomento - reducaoEstoqueAberto, 0);
      }
      await itemOrdem.save({ transaction });

      // Lógica Financeira: valorMaoDeObraDuzia já é o preço por PEÇA (nome do campo é enganoso)
      // - Peças DENTRO do retorno padrão (98% do esperado) → valorMaoDeObraDuzia (M.O base por peça)
      // - Peças EXCEDENTES ao retorno padrão              → valorMaoDeObraDuzia × 1.70 (M.O + 70%)
      const originalEsperado = Number(itemOrdem.volumes || 0) * Number(itemOrdem.pecasPorVolume || 0);
      const meta98 = originalEsperado * 0.98;
      const moBasePorPeca = Number(itemOrdem.produto?.valorMaoDeObraDuzia || 0);
      const moExcedente   = moBasePorPeca * 1.70;

      const pecasDepois     = pecasJaRetornadas + pecasEstaRetornando;
      const dentroAntes     = Math.min(pecasJaRetornadas, meta98);
      const dentroDepois    = Math.min(pecasDepois, meta98);
      const newDentro       = dentroDepois - dentroAntes;       // peças base neste retorno
      const newExcedente    = pecasEstaRetornando - newDentro;  // peças excedentes neste retorno

      const valorTrabalhoRealizado = (newDentro * moBasePorPeca) + (newExcedente * moExcedente);

      if (valorTrabalhoRealizado > 0) {
        await Financeiro.create({
          ordemId: id,
          confeccaoId: ordemServico.confeccaoId,
          valorMaoDeObra: parseFloat(valorTrabalhoRealizado.toFixed(2)),
          pecasProduzidas: pecasEstaRetornando,
          pecasDefeituosas: defeitos,
          status: 'ABERTO',
          dataLancamento: new Date()
        }, { transaction });
      }

      acumuladoRealFinalOS += itemOrdem.pecasReais;
    }

    const itensAbertos = await OrdemItem.count({ where: { ordemId: id, pecasEsperadas: { [Op.gt]: 0 } }, transaction });
    let novoStatus = (statusFrontend === 'RETORNADA' || retornoTotal || fecharSemQuantidade || itensAbertos === 0) 
      ? 'RETORNADA' 
      : 'EM_PRODUCAO';

    await OrdemServico.update({
      status: novoStatus,
      dataRetorno: novoStatus === 'RETORNADA' ? formatDateToYYYYMMDD(new Date()) : null,
      totalPecasReais: acumuladoRealFinalOS,
      diferencaPecas: Math.round(acumuladoRealFinalOS - Number(ordemServico.totalPecasEsperadas || 0))
    }, { where: { id }, transaction });

    await transaction.commit();
    return res.json({ success: true, status: novoStatus });
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

    // Format item to explicitly hoist produtoCodigo
    const ordemPlain = ordem.get({ plain: true });
    if (ordemPlain.itens) {
      ordemPlain.itens = ordemPlain.itens.map(item => ({
        ...item,
        produtoCodigo: item.produto ? item.produto.codigo : null
      }));
    }

    return res.json({ success: true, ordem: ordemPlain });
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