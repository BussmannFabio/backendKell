// src/controllers/material-controller.js
import Material from '../models/material-model.js';
import { EstoqueMaterial } from '../models/index.js'; // importa o model de estoque
import { sequelize } from '../models/index.js';

// Criar material (cria também entrada em EstoqueMaterial)
export const criarMaterial = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // cria material
    const material = await Material.create(req.body, { transaction: t });

    // cria registro de estoque com a quantidade informada no material (ou 0)
    const quantidadeInicial = Number(req.body.quantidade ?? 0);
    const estoque = await EstoqueMaterial.create({
      materialId: material.id,
      quantidade: quantidadeInicial
    }, { transaction: t });

    await t.commit();

    // Retorna material (se quiser retornar estoque junto, altere aqui)
    return res.status(201).json({ material, estoque });
  } catch (error) {
    await t.rollback();
    console.error('Erro ao criar material:', error);
    return res.status(400).json({ error: error.message });
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

// Atualizar material — atualiza também EstoqueMaterial quando quantidade for passada
export const atualizarMaterial = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const [updated] = await Material.update(req.body, { where: { id }, transaction: t });

    if (updated) {
      // se veio quantidade no body, sincroniza no EstoqueMaterial
      if (req.body.quantidade !== undefined) {
        const quantidadeNova = Number(req.body.quantidade);
        let estoque = await EstoqueMaterial.findOne({ where: { materialId: id }, transaction: t });
        if (!estoque) {
          estoque = await EstoqueMaterial.create({ materialId: id, quantidade: quantidadeNova }, { transaction: t });
        } else {
          estoque.quantidade = quantidadeNova;
          await estoque.save({ transaction: t });
        }
      }

      await t.commit();
      const materialAtualizado = await Material.findByPk(id);
      res.status(200).json(materialAtualizado);
    } else {
      await t.rollback();
      res.status(404).json({ error: 'Material não encontrado' });
    }
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

// Deletar material (remove também EstoqueMaterial)
export const deletarMaterial = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // remove estoque primeiro
    await EstoqueMaterial.destroy({ where: { materialId: id }, transaction: t });

    const deleted = await Material.destroy({ where: { id }, transaction: t });

    if (deleted) {
      await t.commit();
      res.status(204).send();
    } else {
      await t.rollback();
      res.status(404).json({ error: 'Material não encontrado' });
    }
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};
