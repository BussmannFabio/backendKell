import { Produto, ProdutoTamanho } from '../models/index.js';

/* ==========================================================
   🔥 CONTROLLER COMPLETO E ESTÁVEL
   ========================================================== */

/* ---------------------- GET ALL ---------------------- */
export async function listarProdutos(req, res) {
  console.log('🔥 Entrando em listarProdutos controller');

  try {
    console.log('🔄 Etapa 1: Buscando todos os produtos');
    const produtos = await Produto.findAll({ order: [['id', 'ASC']] });
    console.log(`✅ ${produtos.length} produtos encontrados`);

    console.log('🔄 Etapa 2: Buscando todos os tamanhos');
    const tamanhos = await ProdutoTamanho.findAll({
      order: [['produtoId', 'ASC'], ['tamanho', 'ASC']],
    });
    console.log(`✅ ${tamanhos.length} tamanhos encontrados`);

    console.log('🔄 Etapa 3: Montando estrutura final');
    const produtosComTamanhos = produtos.map((produto) => {
      const tamanhosDoProduto = tamanhos
        .filter((t) => t.produtoId === produto.id)
        .map((t) => ({
          id: t.id,
          produtoId: t.produtoId,
          tamanho: t.tamanho,
          estoqueMinimo: t.estoqueMinimo,
        }));

      return {
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        valorMaoDeObraDuzia: produto.valorMaoDeObraDuzia,
        valorMaoDeObraPeca: produto.valorMaoDeObraPeca,
        precoVendaDuzia: produto.precoVendaDuzia,
        precoVendaPeca: produto.precoVendaPeca,
        tamanhos: tamanhosDoProduto,
      };
    });

    console.log(`✅ ${produtosComTamanhos.length} produtos prontos`);
    return res.json(produtosComTamanhos);

  } catch (error) {
    console.error('❌ ERRO CRÍTICO em listarProdutos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
}

/* ---------------------- GET BY ID ---------------------- */
export async function buscarProdutoPorId(req, res) {
  try {
    const { id } = req.params;
    console.log(`🔍 Buscando produto ID: ${id}`);

    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: id },
      order: [['tamanho', 'ASC']],
    });

    return res.json({
      ...produto.toJSON(),
      tamanhos: tamanhos.map((t) => ({
        id: t.id,
        produtoId: t.produtoId,
        tamanho: t.tamanho,
        estoqueMinimo: t.estoqueMinimo,
      })),
    });
  } catch (error) {
    console.error('❌ Erro ao buscar produto por ID:', error);
    return res.status(500).json({ error: 'Erro ao buscar produto', message: error.message });
  }
}

/* ---------------------- CREATE ---------------------- */
export async function criarProduto(req, res) {
  try {
    console.log('🆕 Criando novo produto:', req.body);

    const { tamanhos, ...produtoData } = req.body;

    const produto = await Produto.create({
      codigo: produtoData.codigo,
      descricao: produtoData.descricao,
      valorMaoDeObraDuzia: produtoData.valorMaoDeObraDuzia || 0,
      valorMaoDeObraPeca: produtoData.valorMaoDeObraPeca || null,
      precoVendaDuzia: produtoData.precoVendaDuzia || 0,
      precoVendaPeca: null, // sempre null
    });

    // Se houver tamanhos, criar os registros em ProdutoTamanho
    if (tamanhos && Array.isArray(tamanhos)) {
      const tamanhosParaCriar = tamanhos.map(t => ({
        ...t,
        produtoId: produto.id
      }));
      await ProdutoTamanho.bulkCreate(tamanhosParaCriar);
      console.log(`✅ ${tamanhos.length} tamanhos criados para o produto ID: ${produto.id}`);
    }

    console.log('✅ Produto criado com sucesso ID:', produto.id);

    // Buscar o produto com seus tamanhos para retornar
    const produtoComTamanhos = await Produto.findByPk(produto.id, {
      include: [{
        model: ProdutoTamanho,
        as: 'tamanhos',
        attributes: ['id', 'produtoId', 'tamanho', 'estoqueMinimo']
      }]
    });

    return res.status(201).json(produtoComTamanhos);
  } catch (error) {
    console.error('❌ Erro ao criar produto:', error);
    return res.status(500).json({ error: 'Erro ao criar produto', message: error.message });
  }
}

/* ---------------------- UPDATE ---------------------- */
export async function atualizarProduto(req, res) {
  try {
    const { id } = req.params;
    console.log(`✏️ Atualizando produto ID: ${id}`);

    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const updateData = {
      codigo: req.body.codigo ?? produto.codigo,
      descricao: req.body.descricao ?? produto.descricao,
      valorMaoDeObraDuzia: req.body.valorMaoDeObraDuzia ?? produto.valorMaoDeObraDuzia,
      valorMaoDeObraPeca: req.body.valorMaoDeObraPeca ?? produto.valorMaoDeObraPeca,
      precoVendaDuzia: req.body.precoVendaDuzia ?? produto.precoVendaDuzia,
      precoVendaPeca: null, // mantém null
    };

    await produto.update(updateData);
    console.log('✅ Produto atualizado com sucesso');
    return res.json(produto);
  } catch (error) {
    console.error('❌ Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto', message: error.message });
  }
}

/* ---------------------- DELETE ---------------------- */
export async function deletarProduto(req, res) {
  try {
    const { id } = req.params;
    console.log(`🗑️ Excluindo produto ID: ${id}`);

    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await produto.destroy();
    console.log('✅ Produto excluído com sucesso');
    return res.json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir produto:', error);
    return res.status(500).json({ error: 'Erro ao excluir produto', message: error.message });
  }
}

/* ---------------------- TAMANHOS ---------------------- */
export async function buscarTamanhosPorProduto(req, res) {
  try {
    const { id } = req.params;
    console.log(`📏 Buscando tamanhos do produto ID: ${id}`);

    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: id },
      order: [['tamanho', 'ASC']],
    });

    return res.json(tamanhos);
  } catch (error) {
    console.error('❌ Erro ao buscar tamanhos:', error);
    return res.status(500).json({ error: 'Erro ao buscar tamanhos', message: error.message });
  }
}

/* ---------------------- TAMANHOS POR CÓDIGO ---------------------- */
export async function buscarTamanhosPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    console.log(`🔍 Buscando tamanhos por código: ${codigo}`);

    const produto = await Produto.findOne({ where: { codigo } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: produto.id },
      order: [['tamanho', 'ASC']],
    });

    return res.json(tamanhos);
  } catch (error) {
    console.error('❌ Erro ao buscar tamanhos por código:', error);
    return res.status(500).json({ error: 'Erro ao buscar tamanhos por código', message: error.message });
  }
}

/* ---------------------- PRODUTO POR CÓDIGO ---------------------- */
export async function buscarProdutoPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    console.log(`🔍 Buscando produto por código: ${codigo}`);

    const produto = await Produto.findOne({ where: { codigo } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const tamanhos = await ProdutoTamanho.findAll({
      where: { produtoId: produto.id },
      order: [['tamanho', 'ASC']],
    });

    return res.json({
      ...produto.toJSON(),
      tamanhos: tamanhos.map((t) => ({
        id: t.id,
        produtoId: t.produtoId,
        tamanho: t.tamanho,
        estoqueMinimo: t.estoqueMinimo,
      })),
    });
  } catch (error) {
    console.error('❌ Erro ao buscar produto por código:', error);
    return res.status(500).json({ error: 'Erro ao buscar produto por código', message: error.message });
  }
}

/* ---------------------- BUSCAR CÓDIGOS POR IDS ---------------------- */
export async function buscarCodigosPorIds(req, res) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids))
      return res.status(400).json({ error: 'IDs devem ser um array' });

    const produtos = await Produto.findAll({
      where: { id: ids },
      attributes: ['id', 'codigo'],
      order: [['id', 'ASC']],
    });

    return res.json(produtos);
  } catch (error) {
    console.error('❌ Erro ao buscar códigos por IDs:', error);
    return res.status(500).json({ error: 'Erro ao buscar códigos por IDs', message: error.message });
  }
}
