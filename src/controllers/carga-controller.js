import {
    Carga,
    CargaItem,
    ProdutoTamanho,
    Produto,
    EstoqueSp,
    EstoqueProduto,
} from '../models/index.js';

/* -------- Função auxiliar de formatação -------- */
function formatarData(dataISO) {
    if (!dataISO) return "";
    try {
        const d = new Date(dataISO);
        if (isNaN(d)) return "";
        const ano = d.getUTCFullYear();
        const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(d.getUTCDate()).padStart(2, '0');
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        return "";
    }
}

/* ---------------------- GET ALL CARGAS ---------------------- */
const getAllCargas = async (req, res) => {
    try {
        const cargas = await Carga.findAll({
            include: [{
                model: CargaItem,
                as: 'itensCarga',
                include: [{
                    model: ProdutoTamanho,
                    as: 'produtoTamanho',
                    include: [{ model: Produto, as: 'produto' }]
                }]
            }],
            order: [['id', 'DESC']]
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

/* ---------------------- GET ESTOQUE SP (Corrigido) ---------------------- */
const getEstoqueSp = async (req, res) => {
    try {
        const estoque = await EstoqueSp.findAll({
            // LISTE APENAS AS COLUNAS QUE EXISTEM NO BANCO ATUALMENTE
            attributes: ['id', 'produtoTamanhoId', 'quantidade'], 
            include: [{
                model: ProdutoTamanho,
                as: 'produtoTamanho',
                include: [{ model: Produto, as: 'produto' }]
            }],
            order: [['id', 'ASC']],
        });

        const resposta = estoque.map(e => ({
            id: e.id,
            produtoTamanhoId: e.produtoTamanhoId,
            quantidade: e.quantidade,
            estoqueMinimo: 0, // Valor fixo temporário para não quebrar o frontend
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

/* ---------------------- CREATE CARGA (Central -> SP) ---------------------- */
const createCarga = async (req, res) => {
    const t = await Carga.sequelize.transaction();
    try {
        const { itens, ...dadosCarga } = req.body;

        if (!dadosCarga.data || dadosCarga.data === "Invalid date") {
            throw new Error("Data inválida. Envie no formato YYYY-MM-DD.");
        }

        const carga = await Carga.create(dadosCarga, { transaction: t });

        if (Array.isArray(itens) && itens.length > 0) {
            for (const item of itens) {
                const { produtoTamanhoId, quantidade } = item;
                const qtd = Number(quantidade);
                if (qtd <= 0) continue;

                const estoqueCentral = await EstoqueProduto.findOne({
                    where: { produtoTamanhoId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                if (!estoqueCentral || estoqueCentral.quantidadePronta < qtd) {
                    throw new Error(`Estoque Central insuficiente para o produto ID ${produtoTamanhoId}.`);
                }

                estoqueCentral.quantidadePronta -= qtd;
                await estoqueCentral.save({ transaction: t });

                await CargaItem.create({ ...item, cargaId: carga.id }, { transaction: t });

                const [estoqueSp] = await EstoqueSp.findOrCreate({
                    where: { produtoTamanhoId },
                    defaults: { quantidade: 0, estoqueMinimo: 0 },
                    transaction: t
                });

                estoqueSp.quantidade += qtd;
                await estoqueSp.save({ transaction: t });
            }
        }

        await t.commit();
        res.status(201).json({ message: 'Carga criada com sucesso e estoque movimentado.', id: carga.id });
    } catch (error) {
        await t.rollback();
        console.error('Erro no Create Carga:', error.message);
        res.status(400).json({ error: error.message });
    }
};

/* ---------------------- DELETE CARGA (Estorno: SP -> Central) ---------------------- */
const deleteCarga = async (req, res) => {
    const t = await Carga.sequelize.transaction();
    try {
        const { id } = req.params;
        const carga = await Carga.findByPk(id, {
            include: [{ model: CargaItem, as: 'itensCarga' }],
            transaction: t
        });

        if (!carga) throw new Error('Carga não encontrada');

        for (const item of (carga.itensCarga || [])) {
            const { produtoTamanhoId, quantidade } = item;

            const estoqueSp = await EstoqueSp.findOne({
                where: { produtoTamanhoId },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (estoqueSp) {
                estoqueSp.quantidade -= quantidade;
                if (estoqueSp.quantidade < 0) estoqueSp.quantidade = 0;
                await estoqueSp.save({ transaction: t });
            }

            const [estoqueCentral] = await EstoqueProduto.findOrCreate({
                where: { produtoTamanhoId },
                defaults: { quantidadePronta: 0, quantidadeAberta: 0 },
                transaction: t
            });

            estoqueCentral.quantidadePronta += quantidade;
            await estoqueCentral.save({ transaction: t });
        }

        await CargaItem.destroy({ where: { cargaId: id }, transaction: t });
        await carga.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Carga excluída e estoque estornado com sucesso.' });
    } catch (error) {
        await t.rollback();
        console.error('Erro ao excluir carga:', error);
        res.status(500).json({ error: error.message });
    }
};

/* ---------------------- UPDATE ESTOQUE SP ITEM ---------------------- */
const updateEstoqueSpItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { estoqueMinimo } = req.body;

        console.log(`--- [CONTROLLER] Atualizando Estoque SP ID: ${id} para Mínimo: ${estoqueMinimo}`);

        const item = await EstoqueSp.findByPk(id);

        if (!item) {
            return res.status(404).json({ message: 'Item de estoque não encontrado no banco' });
        }

        await item.update({ estoqueMinimo });

        return res.status(200).json(item);
    } catch (error) {
        console.error('Erro no updateEstoqueSpItem:', error);
        return res.status(500).json({ error: error.message });
    }
};

/* ---------------------- UPDATE CARGA (Geral) ---------------------- */
const updateCarga = async (req, res) => {
    try {
        const { id } = req.params;
        const carga = await Carga.findByPk(id);
        if (!carga) return res.status(404).json({ error: 'Carga não encontrada' });
        await carga.update(req.body);
        res.json({ message: 'Carga atualizada', carga });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar carga' });
    }
};

/* ---------------------- AUXILIARES: BAIXA E RETORNO SP ---------------------- */
const darBaixaEstoqueSp = async (itensBaixa, t) => {
    for (const item of itensBaixa) {
        const { produtoTamanhoId, quantidade } = item;
        const qtdParaDebitar = Number(quantidade) * 12; 

        const estoque = await EstoqueSp.findOne({
            where: { produtoTamanhoId },
            transaction: t,
            lock: t.LOCK.UPDATE 
        });

        if (!estoque) {
            throw new Error(`Produto ${produtoTamanhoId} não tem registro no Estoque SP.`);
        }

        if (Number(estoque.quantidade) < qtdParaDebitar) {
            throw new Error(`Estoque SP insuficiente (ID: ${produtoTamanhoId}). Disponível: ${estoque.quantidade}`);
        }

        estoque.quantidade = Number(estoque.quantidade) - qtdParaDebitar;
        await estoque.save({ transaction: t });
    }
};

const retornarEstoqueSp = async (itensRetorno, t) => {
    for (const item of itensRetorno) {
        const { produtoTamanhoId, quantidade } = item;
        const qtdPecas = quantidade * 12;

        const [estoque] = await EstoqueSp.findOrCreate({
            where: { produtoTamanhoId },
            defaults: { quantidade: 0, estoqueMinimo: 0 },
            transaction: t
        });

        estoque.quantidade += qtdPecas;
        await estoque.save({ transaction: t });
    }
};

export {
    getAllCargas,
    getEstoqueSp,
    createCarga,
    updateCarga,
    deleteCarga,
    updateEstoqueSpItem,
    darBaixaEstoqueSp,
    retornarEstoqueSp
};