// src/routes/movimentacao-material-routes.js
import express from 'express';
import { 
  movimentarEstoqueMaterial, 
  listarMovimentacoes, 
  atualizarMovimentacao, 
  deletarMovimentacao 
} from '../controllers/movimentacao-material-controller.js';

const router = express.Router();

// Criar movimentação
router.post('/', movimentarEstoqueMaterial);

// Listar todas movimentações
router.get('/', listarMovimentacoes);

// Atualizar movimentação por ID
router.patch('/:id', atualizarMovimentacao);

// Deletar movimentação por ID
router.delete('/:id', deletarMovimentacao);

export default router;
