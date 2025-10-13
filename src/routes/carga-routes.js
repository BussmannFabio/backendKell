// src/routes/carga-routes.js
import express from 'express';
import { Carga, CargaItem, ProdutoTamanho, Produto, EstoqueProduto } from '../models/index.js';

const router = express.Router();

// ======================
// Registrar nova carga
// ======================
router.post('/', async (req, res) => {
  const { itens } = req.body; // [{ produtoTamanhoId, quantidade }]
  if (!itens?.length) return res.status(400).json({ message: 'Nenhum item informado.' });

  try {
    const quantidadeTotal = itens.reduce((sum, i) => sum + (i.quantidade || 0), 0);
    const carga = await Carga.create({ quantidadeTotal });

    for (const item of itens) {
      await CargaItem.create({
        cargaId: carga.id,
        produtoTamanhoId: item.produtoTamanhoId,
        quantidade: item.quantidade
      });

      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: item.produtoTamanhoId } });
      if (estoque) {
        estoque.quantidadePronta = Math.max(estoque.quantidadePronta - item.quantidade, 0);
        await estoque.save();
      }
    }

    res.status(201).json({ message: 'Carga registrada com sucesso.', carga });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao registrar carga.' });
  }
});

// ======================
// Listar cargas com itens detalhados
// ======================
router.get('/', async (req, res) => {
  try {
    const cargas = await Carga.findAll({
      include: [
        {
          model: CargaItem,
          as: 'itens',
          include: [
            {
              model: ProdutoTamanho,
              as: 'produtoTamanho',       // agora existe associação em index.js
              include: [
                {
                  model: Produto,
                  as: 'produtoPai'        // alias correto do ProdutoTamanho -> Produto
                }
              ]
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    // Mapeia para formato que Angular espera
    const result = cargas.map(carga => ({
      id: carga.id,
      data: carga.data,
      quantidadeTotal: carga.quantidadeTotal,
      itens: carga.itens.map(item => ({
        produtoCodigo: item.produtoTamanho?.produtoPai?.codigo || '',
        produtoNome: item.produtoTamanho?.produtoPai?.nome || '',
        tamanho: item.produtoTamanho?.tamanho || '',
        quantidade: item.quantidade
      }))
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar cargas.' });
  }
});

// ======================
// Atualizar uma carga (PATCH)
// ======================
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { itens } = req.body;

    const carga = await Carga.findByPk(id);
    if (!carga) return res.status(404).json({ message: 'Carga não encontrada.' });

    if (itens && itens.length) {
      // recalcula total
      const quantidadeTotal = itens.reduce((sum, i) => sum + (i.quantidade || 0), 0);
      carga.quantidadeTotal = quantidadeTotal;
      await carga.save();

      // atualiza itens individualmente
      for (const item of itens) {
        const existente = await CargaItem.findOne({
          where: { cargaId: id, produtoTamanhoId: item.produtoTamanhoId }
        });

        const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: item.produtoTamanhoId } });

        if (existente) {
          if (estoque) {
            estoque.quantidadePronta += existente.quantidade; // devolve o antigo
            estoque.quantidadePronta -= item.quantidade;      // debita o novo
            await estoque.save();
          }
          existente.quantidade = item.quantidade;
          await existente.save();
        } else {
          await CargaItem.create({
            cargaId: id,
            produtoTamanhoId: item.produtoTamanhoId,
            quantidade: item.quantidade
          });
          if (estoque) {
            estoque.quantidadePronta = Math.max(estoque.quantidadePronta - item.quantidade, 0);
            await estoque.save();
          }
        }
      }
    }

    res.json({ message: 'Carga atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar carga.' });
  }
});

// ======================
// Excluir uma carga (DELETE)
// ======================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const carga = await Carga.findByPk(id, { include: [{ model: CargaItem, as: 'itens' }] });

    if (!carga) return res.status(404).json({ message: 'Carga não encontrada.' });

    // devolve o estoque
    for (const item of carga.itens) {
      const estoque = await EstoqueProduto.findOne({ where: { produtoTamanhoId: item.produtoTamanhoId } });
      if (estoque) {
        estoque.quantidadePronta += item.quantidade;
        await estoque.save();
      }
    }

    // exclui itens e carga
    await CargaItem.destroy({ where: { cargaId: id } });
    await Carga.destroy({ where: { id } });

    res.json({ message: 'Carga excluída e estoque revertido com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir carga.' });
  }
});

export default router;
