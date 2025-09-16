// src/controllers/material-controller.js
import Material from '../models/material-model.js';

export const criarMaterial = async (req, res) => {
  try {
    const { nome, unidadeMedida, quantidade, estoqueMinimo } = req.body;
    const material = await Material.create({ nome, unidadeMedida, quantidade, estoqueMinimo });
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listarMateriais = async (req, res) => {
  try {
    const materiais = await Material.findAll();
    res.json({ success: true, materiais }); // <- aqui o frontend entende
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const atualizarMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, unidadeMedida, quantidade, estoqueMinimo } = req.body;
    const material = await Material.findByPk(id);
    if(!material) return res.status(404).json({ error: 'Material não encontrado' });

    await material.update({ nome, unidadeMedida, quantidade, estoqueMinimo });
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletarMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id);
    if(!material) return res.status(404).json({ error: 'Material não encontrado' });

    await material.destroy();
    res.json({ message: 'Material deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
