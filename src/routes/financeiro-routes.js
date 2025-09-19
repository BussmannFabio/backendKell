import express from 'express';
import { listarFinanceiro, atualizarStatusFinanceiro, relatorioGerar } from '../controllers/financeiro-controller.js';

const router = express.Router();

router.get('/', listarFinanceiro);
router.put('/:id/pagar', atualizarStatusFinanceiro);
router.post('/relatorio-gerar', relatorioGerar);

export default router;
