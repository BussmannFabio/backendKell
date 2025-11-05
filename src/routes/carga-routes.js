// src/routes/carga-routes.js
import express from 'express';
import {
  getAllCargas,
  getEstoqueSp,
  createCarga,
  updateCarga,   // ✅ nome certo
  deleteCarga
} from '../controllers/carga-controller.js';

const router = express.Router();

router.get('/', getAllCargas);
router.get('/estoque-sp', getEstoqueSp);
router.post('/', createCarga);
router.put('/:id', updateCarga);
router.delete('/:id', deleteCarga);

export default router;
