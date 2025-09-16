import express from 'express';
import { criarOrdem, listarOrdens, retornarOrdem, deletarOrdem, buscarOrdemPorId, reabrirOrdem} 
from '../controllers/ordemServico-controller.js';

const router = express.Router();

// Criar OS
router.post('/', criarOrdem);

// Listar todas as OS
router.get('/', listarOrdens);

// Buscar OS por ID
router.get('/:id', buscarOrdemPorId);

// Marcar OS como retornada
router.patch('/:id/retornar', retornarOrdem);

// Deletar OS
router.delete('/:id', deletarOrdem);

// Reabrir OS retornada
router.patch('/:id/reabrir', reabrirOrdem);

export default router;
