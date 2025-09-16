import { EstoqueMaterial, EstoqueProduto, ProdutoTamanho, Produto, Material } from '../models/index.js';

// ---------- ESTOQUE DE MATERIAIS ----------
export const getEstoqueMateriais = async (req, res) => {
  try {
    const materiais = await EstoqueMaterial.findAll({
      include: [{ model: Material, as: 'materialPai' }]
    });
    res.json(materiais);
  } catch (err) {
    console.error('Erro ao buscar estoque de materiais:', err);
    res.status(500).json({ error: 'Falha ao buscar estoque de materiais. ' + err.message });
  }
};

export const updateEstoqueMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID do estoque inválido' });

    const { quantidade } = req.body;
    if (quantidade < 0) return res.status(400).json({ error: 'Quantidade não pode ser negativa' });

    const estoque = await EstoqueMaterial.findByPk(id);
    if (!estoque) return res.status(404).json({ error: 'Estoque de material não encontrado' });

    estoque.quantidade = quantidade;
    await estoque.save();

    res.json(estoque);
  } catch (err) {
    console.error('Erro ao atualizar estoque de material:', err);
    res.status(500).json({ error: 'Falha ao atualizar estoque de material. ' + err.message });
  }
};

// ---------- ESTOQUE DE PRODUTOS ----------
export const getEstoqueProdutos = async (req, res) => {
  try {
    const produtos = await EstoqueProduto.findAll({
      include: [
        {
          model: ProdutoTamanho,
          as: 'produtoTamanhoPai',
          include: [{ model: Produto, as: 'produtoPai' }]
        }
      ]
    });
    res.json(produtos);
  } catch (err) {
    console.error('Erro ao buscar estoque de produtos:', err);
    res.status(500).json({ error: 'Falha ao buscar estoque de produtos. ' + err.message });
  }
};

export const updateEstoqueProduto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID do estoque inválido' });

    const { quantidadeAberta, quantidadePronta } = req.body;
    if (quantidadeAberta < 0 || quantidadePronta < 0) {
      return res.status(400).json({ error: 'Quantidade não pode ser negativa' });
    }

    const estoque = await EstoqueProduto.findByPk(id);
    if (!estoque) return res.status(404).json({ error: 'Estoque de produto não encontrado' });

    estoque.quantidadeAberta = quantidadeAberta;
    estoque.quantidadePronta = quantidadePronta;
    await estoque.save();

    res.json(estoque);
  } catch (err) {
    console.error('Erro ao atualizar estoque de produto:', err);
    res.status(500).json({ error: 'Falha ao atualizar estoque de produto. ' + err.message });
  }
};

// ---------- FUNÇÃO AUXILIAR PARA VERIFICAR ESTOQUE ----------
export const verificarEstoque = async (req, res) => {
  try {
    const estoques = await EstoqueProduto.findAll({
      include: [
        {
          model: ProdutoTamanho,
          as: 'produtoTamanhoPai',
          include: [{ model: Produto, as: 'produtoPai' }]
        }
      ],
      where: {
        [sequelize.Op.or]: [
          { quantidadeAberta: { [sequelize.Op.gt]: 0 } },
          { quantidadePronta: { [sequelize.Op.gt]: 0 } }
        ]
      },
      order: [
        ['produtoTamanhoPai', 'produtoPai', 'id', 'ASC'],
        ['produtoTamanhoPai', 'tamanho', 'ASC']
      ]
    });

    const resumo = {
      totalItens: estoques.length,
      totalPecasAbertas: estoques.reduce((sum, e) => sum + Number(e.quantidadeAberta), 0),
      totalPecasProntas: estoques.reduce((sum, e) => sum + Number(e.quantidadePronta), 0)
    };

    res.json({
      success: true,
      resumo,
      estoques
    });

  } catch (error) {
    console.error('❌ Erro ao verificar estoque:', error);
    res.status(500).json({ 
      error: 'Falha ao verificar estoque', 
      message: error.message 
    });
  }
};