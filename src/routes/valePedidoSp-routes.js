import express from 'express';
const router = express.Router();

import {
    criarValePedidoSp,
    finalizarValePedidoSp,
    listarValesPedidoSp,
    deletarValePedidoSp,
    buscarProdutoCompleto,
    buscarPedidoPorId, // ✅ Adicionado
    gerarRelatorioRomaneio,
    gerarRelatorioVale
} from '../controllers/valePedidoSp-controller.js';

// Rotas de CRUD
router.post('/', criarValePedidoSp);
router.get('/', listarValesPedidoSp);
router.get('/:id', buscarPedidoPorId); // ✅ Rota que resolve o erro 404
router.put('/:id/finalizar', finalizarValePedidoSp);
router.delete('/:id', deletarValePedidoSp);
router.get('/produto/:codigo', buscarProdutoCompleto);

/* ======================================================
    ROTAS DE IMPRESSÃO
====================================================== */
router.get('/relatorio/romaneio/:id', gerarRelatorioRomaneio);
router.get('/relatorio/vale/:id', gerarRelatorioVale);

export default router;