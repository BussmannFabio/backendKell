import express from 'express';
import { 
  getEstoqueMateriais, 
  updateEstoqueMaterial, 
  getEstoqueProdutos, 
  updateEstoqueProduto, 
  verificarEstoque // sua função auxiliar que retorna resumo e detalhes
} from '../controllers/estoque-controller.js';

const router = express.Router();

// Materiais
router.get('/materiais', getEstoqueMateriais);
router.put('/materiais/:id', updateEstoqueMaterial);

// Produtos
router.get('/produtos', getEstoqueProdutos);
router.put('/produtos/:id', updateEstoqueProduto);

// Verificar estoque geral (produtos prontos e abertos)
router.get('/resumo', verificarEstoque);

export default router;
