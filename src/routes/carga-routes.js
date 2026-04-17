import express from 'express';
import {
    getAllCargas,
    getEstoqueSp,
    createCarga,
    updateCarga,
    deleteCarga,
    updateEstoqueSpItem 
} from '../controllers/carga-controller.js';

const router = express.Router();

/* =========================================================
   AS ROTAS MAIS ESPECÍFICAS DEVEM VIR PRIMEIRO!
   ========================================================= */

// 1. ROTA DE ATUALIZAÇÃO DO ESTOQUE (A que está dando 404)
// Colocando aqui no topo, garantimos que nada a intercepte.
router.put('/estoque-sp/:id', updateEstoqueSpItem);

// 2. ROTA DE BUSCA DO ESTOQUE
router.get('/estoque-sp', getEstoqueSp);

/* =========================================================
   ROTAS GENÉRICAS / PADRÃO
   ========================================================= */

router.get('/', getAllCargas);
router.post('/', createCarga);

// 3. ROTA COM :id NO FINAL (Se vier antes, ela "come" a rota /estoque-sp)
router.put('/:id', updateCarga);
router.delete('/:id', deleteCarga);

export default router;