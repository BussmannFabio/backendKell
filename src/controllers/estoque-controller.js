import sequelize from '../config/database.js';
import { EstoqueMaterial, EstoqueProduto, ProdutoTamanho, Produto, Material } from '../models/index.js';

// ---------- ESTOQUE DE MATERIAIS ----------
const getEstoqueMateriais = async (req, res) => {
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

const updateEstoqueMaterial = async (req, res) => {
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
const getEstoqueProdutos = async (req, res) => {
    try {
        const produtos = await EstoqueProduto.findAll({
            include: [
                {
                    model: ProdutoTamanho,
                    as: 'produtoTamanho',
                    include: [{ model: Produto, as: 'produto' }]
                }
            ]
        });
        res.json(produtos);
    } catch (err) {
        console.error('Erro ao buscar estoque de produtos:', err);
        res.status(500).json({ error: 'Falha ao buscar estoque de produtos. ' + err.message });
    }
};

const updateEstoqueProduto = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(id)) return res.status(400).json({ error: 'ID do estoque inválido' });

        const { quantidadeAberta, quantidadePronta } = req.body;

        if (
            (quantidadeAberta !== undefined && quantidadeAberta < 0) ||
            (quantidadePronta !== undefined && quantidadePronta < 0)
        ) {
            return res.status(400).json({ error: 'Quantidade não pode ser negativa' });
        }

        const estoque = await EstoqueProduto.findByPk(id);
        if (!estoque) return res.status(404).json({ error: 'Estoque de produto não encontrado' });

        if (quantidadeAberta !== undefined) estoque.quantidadeAberta = quantidadeAberta;
        if (quantidadePronta !== undefined) estoque.quantidadePronta = quantidadePronta;

        await estoque.save();

        res.json(estoque);
    } catch (err) {
        console.error('Erro ao atualizar estoque de produto:', err);
        res.status(500).json({ error: 'Falha ao atualizar estoque de produto. ' + err.message });
    }
};

const verificarEstoque = async (req, res) => {
    try {
        const estoques = await EstoqueProduto.findAll({
            include: [
                {
                    model: ProdutoTamanho,
                    as: 'produtoTamanho',
                    include: [{ model: Produto, as: 'produto' }]
                }
            ],
            where: {
                [sequelize.Op.or]: [
                    { quantidadeAberta: { [sequelize.Op.gt]: 0 } },
                    { quantidadePronta: { [sequelize.Op.gt]: 0 } }
                ]
            },
            order: [
                [{ model: ProdutoTamanho, as: 'produtoTamanho' }, { model: Produto, as: 'produto' }, 'id', 'ASC'],
                [{ model: ProdutoTamanho, as: 'produtoTamanho' }, 'tamanho', 'ASC']
            ]
        });

        const resumo = {
            totalItens: estoques.length,
            totalPecasAbertas: estoques.reduce((sum, e) => sum + Number(e.quantidadeAberta || 0), 0),
            totalPecasProntas: estoques.reduce((sum, e) => sum + Number(e.quantidadePronta || 0), 0)
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

// ------------------------------------------------------------------------------------------
// ---------- FUNÇÃO AUXILIAR DE BAIXA DE ESTOQUE PADRÃO (Guaratinguetá) ----------
// ------------------------------------------------------------------------------------------
/**
 * Realiza a baixa dos itens do pedido no EstoqueProduto (Estoque Padrão).
 * A baixa é sempre feita na quantidadePronta.
 * @param {Array<{produtoTamanhoId: number, quantidade: number}>} itensBaixa - Array de itens e quantidades em DÚZIAS.
 * @param {object} t - Objeto de transação do Sequelize.
 * @returns {Promise<void>}
 */
const darBaixaEstoquePadrao = async (itensBaixa, t) => {
    console.log('[BAIXA PADRÃO] Iniciando baixa de estoque...', itensBaixa);

    const produtoTamanhoIds = itensBaixa.map(item => item.produtoTamanhoId);

    // 1️⃣ Buscar apenas os registros que precisam ser travados — sem JOIN
    const estoquesLock = await EstoqueProduto.findAll({
        where: { produtoTamanhoId: produtoTamanhoIds },
        transaction: t,
        lock: t.LOCK.UPDATE          // 🔥 permitido, pois agora NÃO há LEFT JOIN
    });

    // Criar um mapa rápido
    const estoqueMap = {};
    estoquesLock.forEach(e => estoqueMap[e.produtoTamanhoId] = e);

    // 2️⃣ Buscar dados completos (com JOIN) — sem lock
    const estoquesInfo = await EstoqueProduto.findAll({
        where: { produtoTamanhoId: produtoTamanhoIds },
        include: [
            {
                model: ProdutoTamanho,
                as: 'produtoTamanho',
                include: [{ model: Produto, as: 'produto' }]
            }
        ]
    });

    // Mapear informações completas
    const infoMap = {};
    estoquesInfo.forEach(e => infoMap[e.produtoTamanhoId] = e);

    // 3️⃣ Processar cada item
    for (const item of itensBaixa) {
        const { produtoTamanhoId, quantidade } = item;
        const quantidadePecas = quantidade * 12;

        const estoque = estoqueMap[produtoTamanhoId];
        const info = infoMap[produtoTamanhoId];

        if (!estoque) {
            throw new Error(`Estoque não encontrado para produtoTamanhoId: ${produtoTamanhoId}`);
        }

        const produtoCodigo = info.produtoTamanho.produto.codigo;
        const tamanho = info.produtoTamanho.tamanho;

        if (estoque.quantidadePronta < quantidadePecas) {
            throw new Error(
                `Estoque insuficiente para Cód. ${produtoCodigo} Tam. ${tamanho}. ` +
                `Requer ${quantidadePecas}, disponível ${estoque.quantidadePronta}.`
            );
        }

        // efetua baixa
        estoque.quantidadePronta -= quantidadePecas;
        await estoque.save({ transaction: t });

        console.log(`[BAIXA PADRÃO] Debitado ${quantidadePecas} de ${produtoCodigo} Tam. ${tamanho}`);
    }
};


// ⚠️ EXPORTS FINAIS: todas as funções estão exportadas corretamente
export { 
    getEstoqueMateriais, 
    updateEstoqueMaterial, 
    getEstoqueProdutos, 
    updateEstoqueProduto, 
    verificarEstoque,
    darBaixaEstoquePadrao 
};