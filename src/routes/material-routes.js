import express from 'express';
import {
  criarMaterial,
  listarMateriais,
  atualizarMaterial,
  deletarMaterial
} from '../controllers/material-controller.js';

const router = express.Router();

// Criar novo material
router.post('/', criarMaterial);

// Listar todos os materiais
router.get('/', listarMateriais);

// Atualizar material por ID
router.put('/:id', atualizarMaterial);

// Deletar material por ID
router.delete('/:id', deletarMaterial);

export default router;
