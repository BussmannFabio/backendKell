import { EstoqueMaterial, Material, Financeiro, sequelize } from '../models/index.js';
import { movimentarEstoqueMaterial } from './movimentacao-material-controller.js';

/**
 * Cria um vale de saída de materiais
 * Body esperado:
 * {
 *   colaboradorId: number,
 *   materiais: [
 *     { materialId: number, quantidade: number }
 *   ],
 *   observacao?: string
 * }
 */
export const criarValeSaida = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { colaboradorId, materiais, observacao } = req.body;

    if (!colaboradorId) return res.status(400).json({ error: 'colaboradorId é obrigatório' });
    if (!Array.isArray(materiais) || materiais.length === 0)
      return res.status(400).json({ error: 'materiais é obrigatório e não pode ser vazio' });

    const registroFinanceiro = [];

    // Processa cada material
    for (const item of materiais) {
      const materialId = Number(item.materialId);
      const quantidade = Number(item.quantidade);

      if (!materialId || quantidade <= 0) {
        await t.rollback();
        return res.status(400).json({ error: `Material inválido: ${JSON.stringify(item)}` });
      }

      // Chama movimentação interna (saida)
      let estoque = await EstoqueMaterial.findOne({ where: { materialId }, transaction: t });

      if (!estoque) {
        const material = await Material.findByPk(materialId, { transaction: t });
        if (!material) {
          await t.rollback();
          return res.status(404).json({ error: `Material não encontrado: ${materialId}` });
        }
        estoque = await EstoqueMaterial.create({ materialId, quantidade: Number(material.quantidade ?? 0) }, { transaction: t });
      }

      if (estoque.quantidade < quantidade) {
        await t.rollback();
        return res.status(400).json({ error: `Quantidade insuficiente no estoque para material ${materialId}` });
      }

      estoque.quantidade -= quantidade;
      await estoque.save({ transaction: t });

      // Sincroniza no Material
      await Material.update({ quantidade: estoque.quantidade }, { where: { id: materialId }, transaction: t });

      // Cria registro financeiro
      registroFinanceiro.push({
        materialId,
        colaboradorId,
        quantidade,
        tipo: 'saida',
        observacao: observacao ?? 'Vale de material'
      });
    }

    // Insere no Financeiro
    const financeiros = await Financeiro.bulkCreate(registroFinanceiro, { transaction: t });

    await t.commit();
    return res.json({
      message: 'Vale de saída registrado com sucesso!',
      financeiro: financeiros
    });
  } catch (err) {
    await t.rollback();
    console.error('Erro ao criar vale de saída:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};

/**
 * Listar vales de saída já enviados
 */
export const listarVales = async (req, res) => {
  try {
    const vales = await Financeiro.findAll({
      where: { tipo: 'saida' },
      include: [{ model: Material, as: 'materialPai' }]
    });
    return res.json(vales);
  } catch (err) {
    console.error('Erro ao listar vales:', err);
    return res.status(500).json({ error: 'Falha ao listar vales', message: err.message });
  }
};
