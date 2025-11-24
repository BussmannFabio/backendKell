import {
    Carga,
    CargaItem,
    ProdutoTamanho,
    Produto,
    EstoqueSp,
} from '../models/index.js';

/* ---------------------- GET ALL CARGAS ---------------------- */
const getAllCargas = async (req, res) => {
    try {
        const cargas = await Carga.findAll({
            include: [
                {
                    model: CargaItem,
                    as: 'itensCarga',
                    include: [
                        {
                            model: ProdutoTamanho,
                            as: 'produtoTamanho',
                            include: [
                                { model: Produto, as: 'produto' }
                            ]
                        }
                    ]
                }
            ],
            order: [
                ['id', 'DESC'],
                [{ model: CargaItem, as: 'itensCarga' }, 'quantidade', 'DESC']
            ]
        });

        const resposta = cargas.map(c => {
            const itens = c.itensCarga?.map(i => ({
                quantidade: i.quantidade,
                tamanho: i.produtoTamanho?.tamanho ?? "",
                produtoCodigo: i.produtoTamanho?.produto?.codigo ?? "",
                produtoNome: i.produtoTamanho?.produto?.nome ?? ""
            })) || [];

            return {
                id: c.id,
                data: formatarData(c.data),
                descricao: c.descricao ?? "",
                quantidadeTotal: itens.reduce((acc, obj) => acc + (obj.quantidade || 0), 0),
                itens
            };
        });

        res.json(resposta);

    } catch (error) {
        console.error('Erro ao buscar cargas:', error);
        res.status(500).json({ error: 'Erro ao buscar cargas' });
    }
};

/* -------- Função auxiliar de formatação -------- */
function formatarData(dataISO) {
    if (!dataISO) return ""; // evita erros

    // 👉 Se vier objeto Date, converte
    if (dataISO instanceof Date) {
        const ano = dataISO.getFullYear();
        const mes = String(dataISO.getMonth() + 1).padStart(2, '0');
        const dia = String(dataISO.getDate()).padStart(2, '0');
        return `${dia}/${mes}/${ano}`;
    }

    // 👉 Se vier número (timestamp)
    if (typeof dataISO === 'number') {
        const d = new Date(dataISO);
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${dia}/${mes}/${ano}`;
    }

    // 👉 Se vier string mas não contém '-', tenta converter
    if (typeof dataISO === 'string' && !dataISO.includes('-')) {
        const d = new Date(dataISO);
        if (!isNaN(d)) {
            const ano = d.getFullYear();
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            return `${dia}/${mes}/${ano}`;
        }
    }

    // 👉 Aqui assumimos que está em formato YYYY-MM-DD
    try {
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        console.error("Erro ao formatar data:", dataISO, e);
        return "";
    }
}


/* ---------------------- GET ESTOQUE SP ---------------------- */
const getEstoqueSp = async (req, res) => {
    try {
        const estoque = await EstoqueSp.findAll({
            include: [
                {
                    model: ProdutoTamanho,
                    as: 'produtoTamanho',
                    include: [{ model: Produto, as: 'produto' }]
                }
            ],
            order: [['id', 'ASC']],
        });

        // 🔥 FORMATAR PARA O FRONTEND
        const resposta = estoque.map(e => ({
            id: e.id,
            produtoTamanhoId: e.produtoTamanhoId,
            quantidade: e.quantidade,

            // preenchidos corretamente!
            produtoCodigo: e.produtoTamanho?.produto?.codigo || null,
            produtoNome: e.produtoTamanho?.produto?.nome || null,
            tamanho: e.produtoTamanho?.tamanho || null
        }));

        res.json(resposta);

    } catch (error) {
        console.error('Erro ao buscar estoque SP:', error);
        res.status(500).json({ error: 'Erro ao buscar estoque SP' });
    }
};


/* ---------------------- CREATE CARGA ---------------------- */
const createCarga = async (req, res) => {
    const t = await Carga.sequelize.transaction();

    try {
        const { itens, ...dadosCarga } = req.body;

        // ❗ Backend espera data ISO (YYYY-MM-DD)
        if (!dadosCarga.data || dadosCarga.data === "Invalid date") {
            throw new Error("Data inválida. Envie no formato YYYY-MM-DD.");
        }

        const carga = await Carga.create(dadosCarga, { transaction: t });

        // Inserir itens
        if (Array.isArray(itens) && itens.length > 0) {
            for (const item of itens) {
                await CargaItem.create(
                    { ...item, cargaId: carga.id },
                    { transaction: t }
                );

                // Atualiza Estoque SP (entrada)
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
                        {
                            produtoTamanhoId: item.produtoTamanhoId,
                            quantidade: item.quantidade
                        },
                        { transaction: t }
                    );
                }
            }
        }

        await t.commit();

        res.status(201).json({
            message: 'Carga criada com sucesso',
            cargaId: carga.id
        });

    } catch (error) {
        await t.rollback();
        console.error('Erro ao criar carga:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar carga' });
    }
};

/* ---------------------- UPDATE CARGA ---------------------- */
const updateCarga = async (req, res) => {
    try {
        const { id } = req.params;
        const carga = await Carga.findByPk(id);

        if (!carga)
            return res.status(404).json({ error: 'Carga não encontrada' });

        await carga.update(req.body);
        res.json({ message: 'Carga atualizada com sucesso', carga });

    } catch (error) {
        console.error('Erro ao atualizar carga:', error);
        res.status(500).json({ error: 'Erro ao atualizar carga' });
    }
};

/* ---------------------- DELETE CARGA ---------------------- */
const deleteCarga = async (req, res) => {
    try {
        const { id } = req.params;

        const carga = await Carga.findByPk(id);

        if (!carga)
            return res.status(404).json({ error: 'Carga não encontrada' });

        await carga.destroy();
        res.json({ message: 'Carga excluída com sucesso' });

    } catch (error) {
        console.error('Erro ao excluir carga:', error);
        res.status(500).json({ error: 'Erro ao excluir carga' });
    }
};

/* ---------------------- BAIXA DE ESTOQUE SP ---------------------- */
const darBaixaEstoqueSp = async (itensBaixa, t) => {
    console.log('[BAIXA SP] Iniciando baixa de estoque...', itensBaixa);

    const produtoTamanhoIds = itensBaixa.map(item => item.produtoTamanhoId);

    // Garante INNER JOIN e LOCK.UPDATE para consistência e evitar o erro do PostgreSQL
    const estoques = await EstoqueSp.findAll({
        where: { produtoTamanhoId: produtoTamanhoIds },
        include: [{
            model: ProdutoTamanho,
            as: 'produtoTamanho',
            required: true, // Força INNER JOIN para ProdutoTamanho (necessário para o FOR UPDATE)
            include: [{ 
                model: Produto, 
                as: 'produto',
                required: true // Força INNER JOIN para Produto
            }]
        }],
        transaction: t,
        lock: t.LOCK.UPDATE
    });

    const estoqueMap = {};
    estoques.forEach(e => estoqueMap[e.produtoTamanhoId] = e);

    for (const item of itensBaixa) {
        const { produtoTamanhoId, quantidade } = item;
        
        // 💡 CORREÇÃO DE LÓGICA: Converter a quantidade de dúzias (unidade do pedido) para peças (unidade do estoque).
        const quantidadeEmPecas = quantidade * 12;

        const estoque = estoqueMap[produtoTamanhoId];
        if (!estoque) {
            throw new Error(`Estoque SP não encontrado para produtoTamanhoId: ${produtoTamanhoId}`);
        }

        // 1. Verificar estoque com a quantidade convertida em peças
        if (estoque.quantidade < quantidadeEmPecas) { 
            const produtoCodigo = estoque.produtoTamanho.produto.codigo;
            const tamanho = estoque.produtoTamanho.tamanho;

            throw new Error(
                `Estoque insuficiente para Cód. ${produtoCodigo} Tam. ${tamanho}. ` +
                `Requer ${quantidade} dúzias (${quantidadeEmPecas} peças), disponível ${estoque.quantidade} peças.`
            );
        }

        // 2. Debitar a quantidade convertida em peças
        estoque.quantidade -= quantidadeEmPecas; 
        await estoque.save({ transaction: t });

        console.log(`[BAIXA SP] Debitado ${quantidade} duzias (${quantidadeEmPecas} peças) do produtoTamanhoId ${produtoTamanhoId}`);
    }
};

export {
    getAllCargas,
    getEstoqueSp,
    createCarga,
    updateCarga,
    deleteCarga,
    darBaixaEstoqueSp
};