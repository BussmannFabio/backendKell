import express from 'express';
import { 
  criarOrdem, 
  listarOrdens, 
  retornarOrdem, 
  deletarOrdem, 
  buscarOrdemPorId, 
  reabrirOrdem,
  editarOrdem // <-- Novo método
} from '../controllers/ordemServico-controller.js';

const router = express.Router();

router.post('/', criarOrdem);
router.get('/', listarOrdens);
router.get('/:id', buscarOrdemPorId);
router.put('/:id', editarOrdem); // <-- Rota de Edição

router.patch('/:id/retornar', retornarOrdem);
router.patch('/:id/reabrir', reabrirOrdem);
router.delete('/:id', deletarOrdem);

export default router;