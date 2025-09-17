import Produto from '../models/produto-model.js';
import ProdutoTamanho from '../models/produtoTamanho-model.js';

// Criar produto com tamanhos
export const criarProduto = async (req, res) => {
  try {
    const { codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca, tamanhos } = req.body;

    const produto = await Produto.create({ codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca });

    if (tamanhos && tamanhos.length > 0) {
      const novosTamanhos = tamanhos.map(t => ({
        produtoId: produto.id,
        tamanho: t.tamanho,
        estoqueMinimo: t.estoqueMinimo
      }));
      await ProdutoTamanho.bulkCreate(novosTamanhos);
    }

    const produtoCompleto = await Produto.findByPk(produto.id, { include: 'tamanhos' });
    res.status(201).json(produtoCompleto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Listar produtos com tamanhos
export const listarProdutos = async (req, res) => {
  try {
    const produtos = await Produto.findAll({ include: 'tamanhos' });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Buscar produto por ID (com tamanhos)
export const buscarProdutoPorId = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id, { include: 'tamanhos' });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualizar produto e tamanhos
// controllers/produto-controller.js
export const atualizarProduto = async (req, res) => {
  const { id } = req.params;
  const { codigo, valorMaoDeObraDuzia, valorMaoDeObraPeca, tamanhos } = req.body;

  const transaction = await Produto.sequelize.transaction();
  try {
    const produto = await Produto.findByPk(id, { transaction });
    if (!produto) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Atualiza apenas campos enviados (evita sobrescrever com undefined/null)
    const toUpdate = {};
    if (codigo !== undefined) toUpdate.codigo = codigo;
    if (valorMaoDeObraDuzia !== undefined) toUpdate.valorMaoDeObraDuzia = valorMaoDeObraDuzia;
    if (valorMaoDeObraPeca !== undefined) toUpdate.valorMaoDeObraPeca = valorMaoDeObraPeca;

    if (Object.keys(toUpdate).length > 0) {
      await produto.update(toUpdate, { transaction });
    }

    // Se vier array de tamanhos, atualiza/cria individualmente sem apagar tudo
    if (Array.isArray(tamanhos)) {
      for (const t of tamanhos) {
        // sanitize/normalize
        const tamObj = {
          tamanho: t.tamanho,
          estoqueMinimo: t.estoqueMinimo
        };

        if (t.id) {
          // tenta atualizar tamanho existente (somente se pertencer a este produto)
          const existente = await ProdutoTamanho.findOne({
            where: { id: t.id, produtoId: id },
            transaction
          });

          if (existente) {
            await existente.update(tamObj, { transaction });
          } else {
            // id informado mas não encontrado / não pertence a esse produto:
            // criamos novo registro para evitar perder dados — ajuste se preferir erro
            await ProdutoTamanho.create({ produtoId: id, ...tamObj }, { transaction });
          }
        } else {
          // novo tamanho — cria
          await ProdutoTamanho.create({ produtoId: id, ...tamObj }, { transaction });
        }
      }

      // Opcional: NÃO apagar automaticamente tamanhos omitidos no payload.
      // Se quiser remover explicitamente, passe no payload algo como `removerTamanhos: [id1, id2]`
      // e trate aqui: await ProdutoTamanho.destroy({ where: { id: removerIds, produtoId: id }, transaction });
    }

    await transaction.commit();

    const produtoAtualizado = await Produto.findByPk(id, { include: 'tamanhos' });
    return res.json(produtoAtualizado);
  } catch (error) {
    await transaction.rollback();
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: error.message });
  }
};


// Deletar produto
export const deletarProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await ProdutoTamanho.destroy({ where: { produtoId: id } });
    await produto.destroy();

    res.json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
