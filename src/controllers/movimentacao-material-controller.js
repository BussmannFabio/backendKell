import { EstoqueMaterial, Material, MovimentacaoMaterial, Confeccao, User, sequelize } from '../models/index.js';

export const movimentarEstoqueMaterial = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const materialId = Number(req.body.materialId);
    const quantidade = Number(req.body.quantidade);
    const tipo = req.body.tipo;
    const confeccaoId = req.body.confeccaoId ?? null;
    const usuarioId = req.body.usuarioId ?? null;
    const valorUnitario = req.body.valorUnitario ?? null;
    const observacao = req.body.observacao ?? null;
    const emAberto = req.body.emAberto !== undefined ? !!req.body.emAberto : true;

    if (!materialId || Number.isNaN(materialId)) {
      await t.rollback();
      return res.status(400).json({ error: 'materialId inválido' });
    }
    if (!quantidade || Number.isNaN(quantidade) || quantidade <= 0) {
      await t.rollback();
      return res.status(400).json({ error: 'quantidade inválida (deve ser > 0)' });
    }
    if (!tipo || !['entrada', 'saida'].includes(tipo)) {
      await t.rollback();
      return res.status(400).json({ error: 'tipo inválido. Use "entrada" ou "saida".' });
    }

    let estoque = await EstoqueMaterial.findOne({ where: { materialId }, transaction: t });

    if (!estoque) {
      const material = await Material.findByPk(materialId, { transaction: t });
      if (!material) {
        await t.rollback();
        return res.status(404).json({ error: 'Material não encontrado para criar estoque' });
      }
      estoque = await EstoqueMaterial.create({ materialId, quantidade: Number(material.quantidade ?? 0) }, { transaction: t });
    }

    if (tipo === 'entrada') {
      estoque.quantidade += quantidade;
    } else {
      if (estoque.quantidade < quantidade) {
        await t.rollback();
        return res.status(400).json({ error: 'Quantidade insuficiente no estoque' });
      }
      estoque.quantidade -= quantidade;
    }

    await estoque.save({ transaction: t });
    await Material.update({ quantidade: estoque.quantidade }, { where: { id: materialId }, transaction: t });

    const mov = await MovimentacaoMaterial.create({
      materialId,
      tipo,
      quantidade,
      valorUnitario,
      confeccaoId,
      usuarioId,
      referenciaFinanceiraId: req.body.referenciaFinanceiraId ?? null,
      emAberto,
      observacao
    }, { transaction: t });

    await t.commit();

    const movIncl = await MovimentacaoMaterial.findByPk(mov.id, {
      include: [
        { model: Material, as: 'material' },
        ...(confeccaoId ? [{ model: Confeccao, as: 'confeccao' }] : []),
        ...(usuarioId ? [{ model: User, as: 'usuario' }] : [])
      ]
    });

    const estoqueIncl = await EstoqueMaterial.findOne({
      where: { materialId },
      include: [{ model: Material, as: 'materialPai' }]
    });

    return res.status(201).json({
      message: `Movimentação de ${tipo} registrada com sucesso`,
      movimentacao: movIncl,
      estoque: estoqueIncl
    });
  } catch (err) {
    await t.rollback();
    console.error('Erro ao movimentar estoque:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};

export const atualizarMovimentacao = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = req.body;

    const movimentacao = await MovimentacaoMaterial.findByPk(id);
    if (!movimentacao) return res.status(404).json({ error: 'Movimentação não encontrada' });

    await movimentacao.update(campos);
    const movimentacaoAtualizada = await MovimentacaoMaterial.findByPk(id, {
      include: [
        { model: Material, as: 'material' },
        { model: Confeccao, as: 'confeccao' },
        { model: User, as: 'usuario' }
      ]
    });

    res.json(movimentacaoAtualizada);
  } catch (err) {
    console.error('Erro ao atualizar movimentação:', err);
    res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};

export const deletarMovimentacao = async (req, res) => {
  try {
    const { id } = req.params;

    const movimentacao = await MovimentacaoMaterial.findByPk(id);
    if (!movimentacao) return res.status(404).json({ error: 'Movimentação não encontrada' });

    await movimentacao.destroy();
    res.json({ message: 'Movimentação deletada com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar movimentação:', err);
    res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};

export const listarMovimentacoes = async (req, res) => {
  try {
    const movimentacoes = await MovimentacaoMaterial.findAll({
      include: [
        { model: Material, as: 'material' },
        { model: Confeccao, as: 'confeccao' },
        { model: User, as: 'usuario' }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.json(movimentacoes);
  } catch (err) {
    console.error('Erro ao listar movimentações:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
