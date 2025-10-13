// controllers/produto-controller.js
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

// Buscar tamanhos por produto (por ID)
export const buscarTamanhosPorProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id, {
      include: [{ model: ProdutoTamanho, as: 'tamanhos', attributes: ['id', 'tamanho', 'estoqueMinimo'] }]
    });

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado.' });

    const tamanhos = produto.tamanhos?.map(t => ({
      id: t.id,
      tamanho: t.tamanho,
      estoqueMinimo: t.estoqueMinimo
    })) || [];

    res.json({ produtoId: produto.id, codigo: produto.codigo, tamanhos });
  } catch (error) {
    console.error('Erro ao buscar tamanhos do produto:', error);
    res.status(500).json({ error: error.message });
  }
};

// *** NOVA função: Buscar tamanhos por CÓDIGO do produto ***
export const buscarTamanhosPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    // aceita codigo como string ou number - tenta converter para number quando possível
    const parsedCodigo = (codigo !== undefined && codigo !== null && !isNaN(Number(codigo))) ? Number(codigo) : codigo;

    const produto = await Produto.findOne({
      where: { codigo: parsedCodigo },
      include: [{ model: ProdutoTamanho, as: 'tamanhos', attributes: ['id', 'tamanho', 'estoqueMinimo'] }]
    });

    if (!produto) {
      return res.status(404).json({ error: `Produto com codigo ${codigo} não encontrado.` });
    }

    const tamanhos = produto.tamanhos?.map(t => ({
      id: t.id,
      tamanho: t.tamanho,
      estoqueMinimo: t.estoqueMinimo
    })) || [];

    return res.json({ produtoId: produto.id, codigo: produto.codigo, tamanhos });
  } catch (error) {
    console.error('Erro ao buscar tamanhos por codigo:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Atualizar produto e tamanhos
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

    const toUpdate = {};
    if (codigo !== undefined) toUpdate.codigo = codigo;
    if (valorMaoDeObraDuzia !== undefined) toUpdate.valorMaoDeObraDuzia = valorMaoDeObraDuzia;
    if (valorMaoDeObraPeca !== undefined) toUpdate.valorMaoDeObraPeca = valorMaoDeObraPeca;

    if (Object.keys(toUpdate).length > 0) {
      await produto.update(toUpdate, { transaction });
    }

    if (Array.isArray(tamanhos)) {
      for (const t of tamanhos) {
        const tamObj = {
          tamanho: t.tamanho,
          estoqueMinimo: t.estoqueMinimo
        };

        if (t.id) {
          const existente = await ProdutoTamanho.findOne({
            where: { id: t.id, produtoId: id },
            transaction
          });

          if (existente) {
            await existente.update(tamObj, { transaction });
          } else {
            await ProdutoTamanho.create({ produtoId: id, ...tamObj }, { transaction });
          }
        } else {
          await ProdutoTamanho.create({ produtoId: id, ...tamObj }, { transaction });
        }
      }
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

// Buscar códigos de produtos a partir de IDs
export const buscarCodigosPorIds = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs inválidos ou ausentes.' });
    }

    const produtos = await Produto.findAll({
      where: { id: ids },
      attributes: ['id', 'codigo']
    });

    if (!produtos.length) {
      console.warn('[ProdutoController] Nenhum produto encontrado para os IDs:', ids);
      return res.status(404).json({ error: 'Nenhum produto encontrado para os IDs fornecidos.' });
    }

    const map = {};
    for (const p of produtos) {
      map[p.id] = p.codigo;
    }

    console.log('[ProdutoController] Produtos encontrados para IDs:', map);

    res.json({ success: true, produtos: map });
  } catch (error) {
    console.error('Erro ao buscar códigos dos produtos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Buscar produto por código (com tamanhos)
export const buscarProdutoPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const parsedCodigo = (codigo !== undefined && codigo !== null && !isNaN(Number(codigo))) ? Number(codigo) : codigo;

    const produto = await Produto.findOne({
      where: { codigo: parsedCodigo },
      include: 'tamanhos'
    });

    if (!produto) {
      return res.status(404).json({ error: `Produto com código ${codigo} não encontrado.` });
    }

    res.json(produto);
  } catch (error) {
    console.error('Erro ao buscar produto por código:', error);
    res.status(500).json({ error: error.message });
  }
};
