// src/routes/material-routes.js
import express from 'express';
import { criarMaterial, listarMateriais, atualizarMaterial, deletarMaterial } from '../controllers/material-controller.js';

const router = express.Router();

router.post('/', criarMaterial);
router.get('/', listarMateriais);
router.put('/:id', atualizarMaterial);
router.delete('/:id', deletarMaterial);

export default router;
