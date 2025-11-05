import {
  Carga,
  CargaItem,
  ProdutoTamanho,
  Produto,
  EstoqueSp,
} from '../models/index.js';

/* ---------------------- GET ALL CARGAS ---------------------- */
export async function getAllCargas(req, res) {
  try {
    const cargas = await Carga.findAll({
      include: [
        {
          model: CargaItem,
          as: 'itensCarga', // ✅ alias corrigido
          include: [
            {
              model: ProdutoTamanho,
              as: 'produtoTamanho', // ✅ alias correto
              include: [{ model: Produto, as: 'produto' }], // ✅ sem produtoPai
            },
          ],
        },
      ],
      order: [['id', 'DESC']],
    });

    res.json(cargas);
  } catch (error) {
    console.error('Erro ao buscar cargas:', error);
    res.status(500).json({ error: 'Erro ao buscar cargas' });
  }
}

/* ---------------------- GET ESTOQUE SP ---------------------- */
export async function getEstoqueSp(req, res) {
  try {
    const estoque = await EstoqueSp.findAll({
      include: [
        {
          model: ProdutoTamanho,
          as: 'produtoTamanho', // ✅ corrigido
          include: [{ model: Produto, as: 'produto' }], // ✅ corrigido
        },
      ],
      order: [['id', 'ASC']],
    });

    res.json(estoque);
  } catch (error) {
    console.error('Erro ao buscar estoque SP:', error);
    res.status(500).json({ error: 'Erro ao buscar estoque SP' });
  }
}

/* ---------------------- CREATE CARGA ---------------------- */
export async function createCarga(req, res) {
  const t = await Carga.sequelize.transaction();
  try {
    const { itens, ...dadosCarga } = req.body;

    const carga = await Carga.create(dadosCarga, { transaction: t });

    if (Array.isArray(itens) && itens.length > 0) {
      for (const item of itens) {
        await CargaItem.create(
          { ...item, cargaId: carga.id },
          { transaction: t }
        );

        const estoque = await EstoqueSp.findOne({
          where: { produtoTamanhoId: item.produtoTamanhoId },
          transaction: t,
        });

        if (estoque) {
          await estoque.increment('quantidade', {
            by: item.quantidade,
            transaction: t,
          });
        } else {
          await EstoqueSp.create(
            { produtoTamanhoId: item.produtoTamanhoId, quantidade: item.quantidade },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();
    res.status(201).json({ message: 'Carga criada com sucesso', carga });
  } catch (error) {
    await t.rollback();
    console.error('Erro ao criar carga:', error);
    res.status(500).json({ error: 'Erro ao criar carga' });
  }
}

/* ---------------------- UPDATE CARGA ---------------------- */
export async function updateCarga(req, res) {
  try {
    const { id } = req.params;
    const carga = await Carga.findByPk(id);
    if (!carga) return res.status(404).json({ error: 'Carga não encontrada' });

    await carga.update(req.body);
    res.json(carga);
  } catch (error) {
    console.error('Erro ao atualizar carga:', error);
    res.status(500).json({ error: 'Erro ao atualizar carga' });
  }
}

/* ---------------------- DELETE CARGA ---------------------- */
export async function deleteCarga(req, res) {
  try {
    const { id } = req.params;
    const carga = await Carga.findByPk(id);

    if (!carga) return res.status(404).json({ error: 'Carga não encontrada' });

    await carga.destroy();
    res.json({ message: 'Carga excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir carga:', error);
    res.status(500).json({ error: 'Erro ao excluir carga' });
  }
}
