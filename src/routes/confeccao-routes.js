import express from 'express';
import {Confeccao} from '../models/index.js';

const router = express.Router();

// Criar Confeccao
router.post('/', async (req, res) => {
  try {
    const confeccao = await Confeccao.create(req.body);
    res.status(201).json(confeccao);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todas as Confeccoes
router.get('/', async (req, res) => {
  try {
    const confeccoes = await Confeccao.findAll();
    res.json(confeccoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar Confeccao por ID
router.get('/:id', async (req, res) => {
  try {
    const confeccao = await Confeccao.findByPk(req.params.id);
    if (!confeccao) return res.status(404).json({ error: 'Confeccao não encontrada' });
    res.json(confeccao);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar Confeccao
router.delete('/:id', async (req, res) => {
  try {
    const confeccao = await Confeccao.findByPk(req.params.id);
    if (!confeccao) return res.status(404).json({ error: 'Confeccao não encontrada' });
    
    await confeccao.destroy(); // Remove do banco
    res.json({ message: 'Confeccao deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
