// src/routes/financeiro-routes.js
import express from 'express';
import { listarFinanceiro, atualizarStatusFinanceiro } from '../controllers/financeiro-controller.js';

const router = express.Router();

// Listar todos os registros financeiros
router.get('/', listarFinanceiro);

// Atualizar status de pagamento de um registro
router.put('/:id/pagar', atualizarStatusFinanceiro);

export default router;
