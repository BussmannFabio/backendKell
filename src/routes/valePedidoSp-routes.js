import express from 'express';
import {
  criarValePedidoSp,
  listarValesPedidoSp,
  deletarValePedidoSp,
  buscarProdutoCompleto,
  gerarRelatorioValePedido 
} from '../controllers/valePedidoSp-controller.js';

const router = express.Router();

// --- ROTAS DO VALE PEDIDO SP ---

// Buscar tamanhos + preço do produto
// Rota Final: GET /vale-pedido-sp/produto/:codigo
router.get('/produto/:codigo', buscarProdutoCompleto);

// ROTA DE RELATÓRIO (NOVA)
// Rota Final: GET /vale-pedido-sp/:id/relatorio
router.get('/:id/relatorio', gerarRelatorioValePedido); 

// --- ROTAS CRUD ---

// Rota Final: POST /vale-pedido-sp
router.post('/', criarValePedidoSp);

// Rota Final: GET /vale-pedido-sp
router.get('/', listarValesPedidoSp);

// Rota Final: DELETE /vale-pedido-sp/:id
router.delete('/:id', deletarValePedidoSp);

export default router;