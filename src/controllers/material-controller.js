// src/controllers/material-controller.js
import Material from '../models/material-model.js';

// Criar material
export const criarMaterial = async (req, res) => {
  try {
    const material = await Material.create(req.body);
    res.status(201).json(material);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Listar materiais
export const listarMateriais = async (req, res) => {
  try {
    const materiais = await Material.findAll();
    res.status(200).json(materiais);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualizar material
export const atualizarMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await Material.update(req.body, { where: { id } });

    if (updated) {
      const materialAtualizado = await Material.findByPk(id);
      res.status(200).json(materialAtualizado);
    } else {
      res.status(404).json({ error: 'Material não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Deletar material
export const deletarMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Material.destroy({ where: { id } });

    if (deleted) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Material não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
