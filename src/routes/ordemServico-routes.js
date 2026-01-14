import express from 'express';
import { 
  criarOrdem, 
  listarOrdens, 
  retornarOrdem, 
  deletarOrdem, 
  buscarOrdemPorId, 
  reabrirOrdem 
} from '../controllers/ordemServico-controller.js';

const router = express.Router();

// Operações Principais
router.post('/', criarOrdem);          // Cria OS e debita estoque material (se houver lógica)
router.get('/', listarOrdens);         // Lista com include de itens e confecção
router.get('/:id', buscarOrdemPorId);  // Busca detalhada

// Fluxo de Status
router.patch('/:id/retornar', retornarOrdem); // Baixa itens, gera financeiro e move estoque para 'Pronto'
router.patch('/:id/reabrir', reabrirOrdem);   // Reverte financeiro e estoque, volta para status 'CRIADA'

// Exclusão
router.delete('/:id', deletarOrdem);   // Deleta e ajusta estoques

export default router;