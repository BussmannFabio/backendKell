import express from 'express';
import { 
  criarProduto, 
  listarProdutos, 
  atualizarProduto, 
  deletarProduto, 
  buscarProdutoPorId 
} from '../controllers/produto-controller.js';

const router = express.Router();

// Listar todos os Produtos
router.get('/', listarProdutos);

// Criar Produto
router.post('/', criarProduto);

// Buscar Produto por ID
router.get('/:id', buscarProdutoPorId);

// Atualizar Produto
router.patch('/:id', atualizarProduto);

// Deletar Produto
router.delete('/:id', deletarProduto);

export default router;
