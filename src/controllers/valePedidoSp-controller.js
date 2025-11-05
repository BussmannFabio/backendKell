import { ValePedidoSp, ValePedidoItemSp, ProdutoTamanho, Produto } from '../models/index.js';

export const criarValePedidoSp = async (req, res) => {
  try {
    const { data, destino, itens } = req.body;

    const vale = await ValePedidoSp.create({
      data: data || new Date(),
      destino
    });

    if (Array.isArray(itens) && itens.length > 0) {
      for (const item of itens) {
        await ValePedidoItemSp.create({
          valePedidoSpId: vale.id,
          produtoTamanhoId: item.produtoTamanhoId,
          quantidade: item.quantidade
        });
      }
    }

    const valeCompleto = await ValePedidoSp.findByPk(vale.id, {
      include: [
        {
          model: ValePedidoItemSp,
          as: 'itens',
          include: {
            model: ProdutoTamanho,
            as: 'produtoTamanho',
            include: { model: Produto, as: 'produto' }
          }
        }
      ]
    });

    res.status(201).json(valeCompleto);
  } catch (error) {
    console.error('Erro ao criar vale:', error);
    res.status(500).json({ error: 'Erro ao criar vale de pedido SP.' });
  }
};

export const listarValesPedidoSp = async (req, res) => {
  try {
    const vales = await ValePedidoSp.findAll({
      include: [
        {
          model: ValePedidoItemSp,
          as: 'itens',
          include: {
            model: ProdutoTamanho,
            as: 'produtoTamanho',
            include: { model: Produto, as: 'produto' }
          }
        }
      ],
      order: [['id', 'DESC']]
    });

    res.json(vales);
  } catch (error) {
    console.error('Erro ao listar vales:', error);
    res.status(500).json({ error: 'Erro ao listar vales.' });
  }
};

export const deletarValePedidoSp = async (req, res) => {
  try {
    const { id } = req.params;
    await ValePedidoItemSp.destroy({ where: { valePedidoSpId: id } });
    await ValePedidoSp.destroy({ where: { id } });
    res.json({ message: 'Vale de pedido SP excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir vale:', error);
    res.status(500).json({ error: 'Erro ao excluir vale.' });
  }
};
