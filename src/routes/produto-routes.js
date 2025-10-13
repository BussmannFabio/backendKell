// routes/produtos.js
import express from 'express';
import {
  criarProduto,
  listarProdutos,
  buscarProdutoPorId,
  buscarTamanhosPorProduto,
  buscarTamanhosPorCodigo, // nova
  atualizarProduto,
  deletarProduto,
  buscarCodigosPorIds,
  buscarProdutoPorCodigo
} from '../controllers/produto-controller.js';

const router = express.Router();

// criar / listar
router.post('/', criarProduto);
router.get('/', listarProdutos);

// buscar por código (colocar rotas de código antes da rota ':id' para evitar conflito)
router.get('/codigo/:codigo/tamanhos', buscarTamanhosPorCodigo); // <- novo endpoint específico por código
router.get('/codigo/:codigo', buscarProdutoPorCodigo);

// buscar por id (PK)
router.get('/:id', buscarProdutoPorId);

// rota que devolve apenas tamanhos por id (se necessário)
router.get('/:id/tamanhos', buscarTamanhosPorProduto);

// atualizar / deletar
router.put('/:id', atualizarProduto);
router.delete('/:id', deletarProduto);

// buscar-codigos (por-ids)
router.post('/buscar-codigos', buscarCodigosPorIds);

export default router;
