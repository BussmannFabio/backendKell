import { Produto, ProdutoTamanho } from '../models/index.js';

/* ===================== */
/* SOLUÇÃO 100% GARANTIDA */
/* ===================== */

/* ---------------------- GET ALL - JUNÇÃO MANUAL ---------------------- */
export async function listarProdutos(req, res) {
  console.log('🔥 Entrando em listarProdutos controller real');

  try {
    console.log('🔄 SOLUÇÃO ALTERNATIVA - Buscando produtos com junção manual');
    
    // Busca todos os produtos
    const produtos = await Produto.findAll({
      order: [['id', 'ASC']],
    });

    // Busca todos os tamanhos
    const todosTamanhos = await ProdutoTamanho.findAll({
      order: [['produtoId', 'ASC'], ['tamanho', 'ASC']]
    });

    // Combina os dados manualmente (como um JOIN manual)
    const produtosComTamanhos = produtos.map(produto => {
      const tamanhosDoProduto = todosTamanhos
        .filter(t => t.produtoId === produto.id)
        .map(t => ({
          id: t.id,
          produtoId: t.produtoId,
          tamanho: t.tamanho,
          estoqueMinimo: t.estoqueMinimo
        }));

      return {
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        valorMaoDeObraDuzia: produto.valorMaoDeObraDuzia,
        valorMaoDeObraPeca: produto.valorMaoDeObraPeca,
        precoVendaDuzia: produto.precoVendaDuzia,
        precoVendaPeca: produto.precoVendaPeca,
        tamanhos: tamanhosDoProduto
      };
    });

    console.log(`✅ SUCESSO: ${produtosComTamanhos.length} produtos processados`);
    res.json(produtosComTamanhos);
  } catch (error) {
    console.error('❌ ERRO CRÍTICO em listarProdutos:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

/* ---------------------- GET BY ID - JUNÇÃO MANUAL ---------------------- */
export async function buscarProdutoPorId(req, res) {
  try {
    const { id } = req.params;
    
    // Busca o produto
    const produto = await Produto.findByPk(id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Busca os tamanhos desse produto específico
    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: id },
      order: [['tamanho', 'ASC']]
    });

    // Combina os dados
    const produtoComTamanhos = {
      id: produto.id,
      codigo: produto.codigo,
      descricao: produto.descricao,
      valorMaoDeObraDuzia: produto.valorMaoDeObraDuzia,
      valorMaoDeObraPeca: produto.valorMaoDeObraPeca,
      precoVendaDuzia: produto.precoVendaDuzia,
      precoVendaPeca: produto.precoVendaPeca,
      tamanhos: tamanhos.map(t => ({
        id: t.id,
        produtoId: t.produtoId,
        tamanho: t.tamanho,
        estoqueMinimo: t.estoqueMinimo
      }))
    };

    res.json(produtoComTamanhos);
  } catch (error) {
    console.error('Erro ao buscar produto por ID:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar produto',
      message: error.message
    });
  }
}

/* ---------------------- CREATE ---------------------- */
export async function criarProduto(req, res) {
  try {
    const produto = await Produto.create(req.body);
    res.status(201).json(produto);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ 
      error: 'Erro ao criar produto',
      message: error.message
    });
  }
}

/* ---------------------- UPDATE ---------------------- */
export async function atualizarProduto(req, res) {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id);

    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    await produto.update(req.body);
    res.json(produto);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ 
      error: 'Erro ao atualizar produto',
      message: error.message
    });
  }
}

/* ---------------------- DELETE ---------------------- */
export async function deletarProduto(req, res) {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id);

    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    await produto.destroy();
    res.json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ 
      error: 'Erro ao excluir produto',
      message: error.message
    });
  }
}

/* ---------------------- GET TAMANHOS POR PRODUTO ---------------------- */
export async function buscarTamanhosPorProduto(req, res) {
  try {
    const { id } = req.params;
    const tamanhos = await ProdutoTamanho.findAll({ 
      where: { produtoId: id },
      order: [['tamanho', 'ASC']]
    });
    res.json(tamanhos);
  } catch (error) {
    console.error('Erro ao buscar tamanhos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar tamanhos',
      message: error.message
    });
  }
}

/* ---------------------- GET TAMANHOS POR CÓDIGO ---------------------- */
export async function buscarTamanhosPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    
    // Encontra o produto pelo código
    const produto = await Produto.findOne({ 
      where: { codigo } 
    });
    
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Busca os tamanhos desse produto
    const tamanhos = await ProdutoTamanho.findAll({ 
      where: { produtoId: produto.id },
      order: [['tamanho', 'ASC']]
    });

    res.json(tamanhos);
  } catch (error) {
    console.error('Erro ao buscar tamanhos por código:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar tamanhos por código',
      message: error.message
    });
  }
}

/* ---------------------- GET PRODUTO POR CÓDIGO ---------------------- */
export async function buscarProdutoPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    
    // Busca o produto pelo código
    const produto = await Produto.findOne({ 
      where: { codigo } 
    });
    
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Busca os tamanhos desse produto
    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: produto.id },
      order: [['tamanho', 'ASC']]
    });

    // Combina os dados
    const produtoComTamanhos = {
      id: produto.id,
      codigo: produto.codigo,
      descricao: produto.descricao,
      valorMaoDeObraDuzia: produto.valorMaoDeObraDuzia,
      valorMaoDeObraPeca: produto.valorMaoDeObraPeca,
      precoVendaDuzia: produto.precoVendaDuzia,
      precoVendaPeca: produto.precoVendaPeca,
      tamanhos: tamanhos.map(t => ({
        id: t.id,
        produtoId: t.produtoId,
        tamanho: t.tamanho,
        estoqueMinimo: t.estoqueMinimo
      }))
    };

    res.json(produtoComTamanhos);
  } catch (error) {
    console.error('Erro ao buscar produto por código:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar produto por código',
      message: error.message
    });
  }
}

/* ---------------------- BUSCAR CÓDIGOS POR IDS ---------------------- */
export async function buscarCodigosPorIds(req, res) {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs devem ser um array' });
    }

    const produtos = await Produto.findAll({
      where: { id: ids },
      attributes: ['id', 'codigo'],
      order: [['id', 'ASC']]
    });

    res.json(produtos);
  } catch (error) {
    console.error('Erro ao buscar códigos por IDs:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar códigos por IDs',
      message: error.message
    });
  }
}