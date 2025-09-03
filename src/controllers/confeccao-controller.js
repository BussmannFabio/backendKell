import Confeccao from '../models/confeccao-model.js';

// Criar confecção
export const criarConfeccao = async (req, res) => {
  try {
    const confeccao = await Confeccao.create(req.body);
    res.status(201).json(confeccao);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Listar confecções
export const listarConfeccoes = async (req, res) => {
  try {
    const confeccoes = await Confeccao.findAll();
    res.json(confeccoes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Buscar por ID
export const buscarConfeccao = async (req, res) => {
  try {
    const confeccao = await Confeccao.findByPk(req.params.id);
    if (!confeccao) return res.status(404).json({ error: 'Confecção não encontrada' });
    res.json(confeccao);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
