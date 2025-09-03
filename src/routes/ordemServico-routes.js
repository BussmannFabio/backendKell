import express from 'express';
import { criarOrdem, listarOrdens, atualizarOrdem, deletarOrdem, buscarOrdemPorId } from '../controllers/ordemServico-controller.js';

const router = express.Router();

// Criar OS
router.post('/', criarOrdem);

// Listar todas as OS
router.get('/', listarOrdens);

// Buscar OS por ID
router.get('/:id', buscarOrdemPorId);

// Atualizar OS
router.patch('/:id', atualizarOrdem);

// Deletar OS
router.delete('/:id', deletarOrdem);

export default router;
