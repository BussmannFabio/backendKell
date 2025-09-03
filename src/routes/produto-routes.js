import express from 'express';
import { criarProduto, listarProdutos, atualizarProduto, deletarProduto, buscarProdutoPorId } from '../controllers/produto-controller.js';

const router = express.Router();

// Criar Produto
router.post('/', criarProduto);

// Listar todos os Produtos
router.get('/', listarProdutos);

// Buscar Produto por ID
router.get('/:id', buscarProdutoPorId);

// Atualizar Produto
router.put('/:id', atualizarProduto);

// Deletar Produto
router.delete('/:id', deletarProduto);

export default router;
