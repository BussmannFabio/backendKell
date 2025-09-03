// src/controllers/produto-controller.js
import Produto from '../models/produto-model.js';
import ProdutoTamanho from '../models/produtoTamanho-model.js';

// Criar produto com tamanhos
export const criarProduto = async (req, res) => {
  try {
    const { codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca, tamanhos } = req.body;

    const produto = await Produto.create({ codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca });

    if (tamanhos && tamanhos.length > 0) {
      for (const t of tamanhos) {
        await ProdutoTamanho.create({ produtoId: produto.id, tamanho: t.tamanho, estoqueMinimo: t.estoqueMinimo });
      }
    }

    const produtoCompleto = await Produto.findByPk(produto.id, { include: 'tamanhos' });
    res.status(201).json(produtoCompleto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Listar produtos
export const listarProdutos = async (req, res) => {
  try {
    const produtos = await Produto.findAll({ include: 'tamanhos' });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Buscar produto por ID
export const buscarProdutoPorId = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id, { include: 'tamanhos' });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualizar produto
export const atualizarProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca } = req.body;

    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await produto.update({ codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Deletar produto
export const deletarProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await produto.destroy();
    res.json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
