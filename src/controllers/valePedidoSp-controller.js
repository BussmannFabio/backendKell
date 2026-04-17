import {
    ValePedidoSp,
    ValePedidoItemSp,
    ProdutoTamanho,
    Produto,
    Vendedor,
    sequelize,
} from '../models/index.js';

import { darBaixaEstoquePadrao, retornarEstoquePadrao } from './estoque-controller.js';
import { darBaixaEstoqueSp, retornarEstoqueSp } from './carga-controller.js';

/* =======================================================================
    🔍 AUXILIAR: VERIFICAÇÃO DE CIDADE (SÃO PAULO / SP)
======================================================================= */
const isCidadeSaoPaulo = (cidade) => {
    if (!cidade) return false;
    const normalized = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    return normalized === 'SAO PAULO' || normalized === 'SP';
};

/* =======================================================================
    🔍 BUSCAR PEDIDO POR ID
======================================================================= */
const buscarPedidoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const pedido = await ValePedidoSp.findByPk(id, {
            include: [{
                model: ValePedidoItemSp,
                as: 'itens',
                include: [{ 
                    model: ProdutoTamanho, 
                    as: 'produtoTamanho',
                    include: [{ model: Produto, as: 'produto' }] 
                }]
            }]
        });

        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const data = pedido.toJSON();
        data.itens = data.itens.map(it => ({
            ...it,
            produtoTamanhoId: it.produtoTamanhoId
        }));

        return res.json(data);
    } catch (error) {
        console.error('❌ Erro buscarPedidoPorId:', error);
        res.status(500).json({ error: 'Erro interno ao buscar detalhes do pedido.' });
    }
};

/* =======================================================================
    📝 CRIAR ROMANEIO OU VALE DIRETO (BAIXA IMEDIATA)
======================================================================= */
const criarValePedidoSp = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            cliente, endereco, vendedorId, parcelas,
            dataInicialPagamento, cidadeSeparacao,
            descontoPorcento, volumes, status 
        } = req.body;

        let itensRaw = req.body?.itens ?? req.body?.items;
        if (typeof itensRaw === 'string') itensRaw = JSON.parse(itensRaw);

        if (!cliente || !Array.isArray(itensRaw) || itensRaw.length === 0) {
            if (!t.finished) await t.rollback();
            return res.status(400).json({ error: 'Dados obrigatórios ou itens ausentes.' });
        }

        let nomeVendedor = "Não Informado";
        if (vendedorId) {
            const v = await Vendedor.findByPk(vendedorId);
            if (v) nomeVendedor = v.nome;
        }

        let acumuladorBruto = 0;
        const itensProcessados = itensRaw.map(item => {
            const qtdDz = Number(item.quantidade) || 0;
            const precoDz = Number(item.precoUnitario) || 0; 
            const subtotal = Number((qtdDz * precoDz).toFixed(2));
            acumuladorBruto += subtotal;
            return { ...item, subtotal, precoDz };
        });

        const descPerc = Number(descontoPorcento) || 0;
        const precoTotalFinal = acumuladorBruto * (1 - (descPerc / 100));
        const statusFinal = status || 'ROMANEIO';

        const vale = await ValePedidoSp.create({
            cliente, endereco, vendedor: nomeVendedor,
            parcelas, dataInicialPagamento, cidadeSeparacao,
            valorBruto: Number(acumuladorBruto.toFixed(2)),
            descontoPorcento: descPerc,
            precoTotal: Number(precoTotalFinal.toFixed(2)),
            volumes: Number(volumes) || 1,
            status: statusFinal,
            dataFinalizacao: statusFinal === 'FINALIZADO' ? new Date() : null
        }, { transaction: t });

        const itensParaBaixa = [];
        for (const item of itensProcessados) {
            await ValePedidoItemSp.create({
                valePedidoSpId: vale.id,
                produtoTamanhoId: item.produtoTamanhoId,
                quantidadePedida: item.quantidade,
                quantidade: item.quantidade, 
                precoUnitario: item.precoDz, 
                subtotal: item.subtotal
            }, { transaction: t });

            itensParaBaixa.push({
                produtoTamanhoId: item.produtoTamanhoId,
                quantidade: item.quantidade
            });
        }

        // DESCONTA ESTOQUE SEMPRE (Independente do status, para reservar o produto)
        try {
            if (isCidadeSaoPaulo(cidadeSeparacao)) {
                await darBaixaEstoqueSp(itensParaBaixa, t);
            } else {
                await darBaixaEstoquePadrao(itensParaBaixa, t);
            }
        } catch (estError) {
            throw new Error(`Estoque insuficiente para criar o pedido: ${estError.message}`);
        }

        await t.commit();
        return res.json({ message: 'Pedido criado e estoque reservado!', id: vale.id });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error('❌ Erro criarValePedidoSp:', error);
        return res.status(500).json({ error: error.message });
    }
};

/* =======================================================================
    ✅ FINALIZAR PEDIDO (AJUSTADO PARA CONTROLE DE RESERVA)
======================================================================= */
const finalizarValePedidoSp = async (req, res) => {
    const { id } = req.params;
    const { itens, volumes } = req.body; 
    const t = await sequelize.transaction();

    try {
        const vale = await ValePedidoSp.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!vale) throw new Error('Pedido não encontrado.');

        const isSP = isCidadeSaoPaulo(vale.cidadeSeparacao);

        // 1. ESTORNO OBRIGATÓRIO: Como a criação já baixou o estoque,
        // precisamos devolver o que estava reservado para re-processar o conferido.
        const itensAtuaisNoDb = await ValePedidoItemSp.findAll({ where: { valePedidoSpId: id }, transaction: t });
        const itensParaRetorno = itensAtuaisNoDb.map(i => ({ 
            produtoTamanhoId: i.produtoTamanhoId, 
            quantidade: i.quantidade 
        }));
        
        if (itensParaRetorno.length > 0) {
            try {
                if (isSP) {
                    await retornarEstoqueSp(itensParaRetorno, t);
                } else {
                    await retornarEstoquePadrao(itensParaRetorno, t);
                }
            } catch (err) { console.warn('⚠️ Erro no Estorno de finalização:', err.message); }
        }

        // 2. Atualiza Itens com as novas quantidades conferidas
        const itensParaBaixaDefinitiva = [];
        let novoValorBruto = 0;
        const listaItens = Array.isArray(itens) ? itens : [];

        for (const itemConf of listaItens) {
            const itemDb = await ValePedidoItemSp.findOne({
                where: { valePedidoSpId: id, produtoTamanhoId: itemConf.produtoTamanhoId },
                transaction: t
            });

            if (itemDb) {
                const qtdDz = Number(itemConf.quantidade) || 0;
                const precoDz = Number(itemDb.precoUnitario) || 0; 
                const subtotal = Number((qtdDz * precoDz).toFixed(2));

                itemDb.quantidade = qtdDz;
                itemDb.subtotal = subtotal;
                await itemDb.save({ transaction: t });

                if (qtdDz > 0) {
                    novoValorBruto += subtotal;
                    itensParaBaixaDefinitiva.push({ 
                        produtoTamanhoId: itemDb.produtoTamanhoId, 
                        quantidade: qtdDz 
                    });
                }
            }
        }

        // 3. Baixa de Estoque Definitiva (conforme conferido)
        if (itensParaBaixaDefinitiva.length > 0) {
            try {
                if (isSP) {
                    await darBaixaEstoqueSp(itensParaBaixaDefinitiva, t);
                } else {
                    await darBaixaEstoquePadrao(itensParaBaixaDefinitiva, t);
                }
            } catch (stockError) {
                throw new Error(`Estoque insuficiente na conferência: ${stockError.message}`);
            }
        }

        // 4. ATUALIZAÇÃO DO STATUS E TOTAIS
        const descPerc = Number(vale.descontoPorcento) || 0;
        const valorBrutoFinal = Number(novoValorBruto.toFixed(2));
        const valorComDesconto = Number((valorBrutoFinal * (1 - (descPerc / 100))).toFixed(2));

        await vale.update({
            status: 'FINALIZADO',
            valorBruto: valorBrutoFinal,
            precoTotal: valorComDesconto,
            volumes: Number(volumes) || vale.volumes,
            dataFinalizacao: new Date()
        }, { transaction: t });

        await t.commit();
        res.json({ message: 'Pedido finalizado e estoque ajustado!', id: vale.id });

    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('❌ ERRO NA FINALIZAÇÃO:', error.message);
        res.status(500).json({ error: error.message });
    }
};

/* =======================================================================
    🗑️ DELETAR PEDIDO (DEVOLUÇÃO DE ESTOQUE GARANTIDA)
======================================================================= */
const deletarValePedidoSp = async (req, res) => {
    const { id } = req.params;
    const t = await sequelize.transaction();
    try {
        const vale = await ValePedidoSp.findByPk(id, { 
            include: [{ model: ValePedidoItemSp, as: 'itens' }],
            transaction: t 
        });

        if (!vale) {
            if (!t.finished) await t.rollback();
            return res.status(404).json({ error: 'Não encontrado' });
        }

        // DEVOLVE ESTOQUE SEMPRE (Seja Romaneio ou Finalizado)
        if (vale.itens?.length > 0) {
            const itensParaRetorno = vale.itens.map(i => ({ 
                produtoTamanhoId: i.produtoTamanhoId, 
                quantidade: i.quantidade 
            }));

            try {
                if (isCidadeSaoPaulo(vale.cidadeSeparacao)) {
                    await retornarEstoqueSp(itensParaRetorno, t);
                } else {
                    await retornarEstoquePadrao(itensParaRetorno, t);
                }
            } catch (e) { 
                console.warn('⚠️ Erro ao repor estoque no delete:', e.message); 
            }
        }

        await ValePedidoItemSp.destroy({ where: { valePedidoSpId: id }, transaction: t });
        await ValePedidoSp.destroy({ where: { id }, transaction: t });

        await t.commit();
        return res.json({ message: 'Pedido excluído e estoque devolvido!', id });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error(`❌ Erro deletar:`, error.message);
        return res.status(500).json({ error: error.message });
    }
};

/* =======================================================================
    📋 LISTAGEM E RELATÓRIOS
======================================================================= */
const listarValesPedidoSp = async (req, res) => {
    try {
        const vales = await ValePedidoSp.findAll({
            attributes: ['id', 'cliente', 'vendedor', 'precoTotal', 'status', 'createdAt', 'volumes'],
            order: [['id', 'DESC']]
        });
        return res.json(vales);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar pedidos.' });
    }
};

const buscarProdutoCompleto = async (req, res) => {
    try {
        const produto = await Produto.findOne({ 
            where: { codigo: req.params.codigo },
            include: [{ model: ProdutoTamanho, as: 'tamanhos' }]
        });
        if (!produto) return res.status(404).json({ error: 'Não encontrado' });
        return res.json(produto);
    } catch (error) {
        res.status(500).json({ error: 'Erro na busca' });
    }
};

const gerarRelatorioRomaneio = async (req, res) => {
    try {
        const pedido = await ValePedidoSp.findByPk(req.params.id, {
            include: [{
                model: ValePedidoItemSp, as: 'itens',
                include: [{ model: ProdutoTamanho, as: 'produtoTamanho', include: ['produto'] }]
            }]
        });
        if (!pedido) return res.status(404).send('Pedido não encontrado');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(templateSeparacao(pedido));
    } catch (error) {
        res.status(500).send('Erro ao gerar romaneio');
    }
};

const gerarRelatorioVale = async (req, res) => {
    try {
        const pedido = await ValePedidoSp.findByPk(req.params.id, {
            include: [{
                model: ValePedidoItemSp, as: 'itens',
                include: [{ model: ProdutoTamanho, as: 'produtoTamanho', include: ['produto'] }]
            }]
        });
        if (!pedido) return res.status(404).send('Pedido não encontrado');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(templateValePedidoFinal(pedido));
    } catch (error) {
        res.status(500).send('Erro ao gerar vale');
    }
};

// --- TEMPLATES ---
function templateSeparacao(pedido) {
    const agrupado = {};
    (pedido.itens || []).forEach(item => {
        const cod = item.produtoTamanho?.produto?.codigo || '---';
        if (!agrupado[cod]) agrupado[cod] = { tamanhos: [], total: 0 };
        agrupado[cod].tamanhos.push(`${item.produtoTamanho?.tamanho || ''}(${item.quantidade})`);
        agrupado[cod].total += Number(item.quantidade) || 0;
    });

    const itensHtml = Object.keys(agrupado).map(cod => `
        <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 4px; font-size: 13px;"><strong>${cod}</strong></td>
            <td style="padding: 4px; font-size: 11px; color: #444;">${agrupado[cod].tamanhos.join(' | ')}</td>
            <td style="padding: 4px; text-align: center; font-size: 15px; font-weight: bold;">${agrupado[cod].total.toFixed(2)} dz</td>
            <td style="padding: 4px; border-left: 1px solid #000; text-align: center;">[ ]</td>
        </tr>`).join('');

    return `<html><body style="font-family: sans-serif;"><h2>GUIA DE SEPARAÇÃO #${pedido.id}</h2><p>CLIENTE: ${pedido.cliente}</p><p>ESTOQUE: ${pedido.cidadeSeparacao}</p><table border="1" style="width:100%; border-collapse: collapse;"><thead><tr><th>REF</th><th>TAMANHOS (DZ)</th><th>TOTAL</th><th>OK</th></tr></thead><tbody>${itensHtml}</tbody></table></body></html>`;
}

function templateValePedidoFinal(pedido) {
    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
    const consolidado = {};
    let brutoRecalculado = 0;

    (pedido.itens || []).forEach(item => {
        const cod = item.produtoTamanho?.produto?.codigo || '---';
        const qtdDz = Number(item.quantidade) || 0;
        const precoDz = Number(item.precoUnitario) || 0;

        if (qtdDz > 0) {
            if (!consolidado[cod]) consolidado[cod] = { qtd: 0, subtotal: 0, precoDz };
            consolidado[cod].qtd += qtdDz;
            const subLinha = Number((qtdDz * precoDz).toFixed(2));
            consolidado[cod].subtotal += subLinha;
            brutoRecalculado += subLinha;
        }
    });

    const itensHtml = Object.keys(consolidado).map(cod => `
        <tr>
            <td style="padding: 5px; border-bottom: 1px solid #eee;">${cod}</td>
            <td style="text-align: center; border-bottom: 1px solid #eee;">${consolidado[cod].qtd.toFixed(2)} dz</td>
            <td style="text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(consolidado[cod].precoDz)}</td>
            <td style="text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">${formatCurrency(consolidado[cod].subtotal)}</td>
        </tr>`).join('');

    const descPerc = Number(pedido.descontoPorcento) || 0;
    const valorDesconto = brutoRecalculado * (descPerc / 100);
    const finalLiquido = brutoRecalculado - valorDesconto;

    const layoutVia = (titulo) => `
        <div style="width: 48%; float: left; border: 1px dashed #000; padding: 10px; margin: 1%; box-sizing: border-box; min-height: 14cm; font-family: sans-serif;">
            <div style="text-align: center; border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px;">
                <h3 style="margin: 0;">VALE PEDIDO SP</h3>
                <small>${titulo} | Pedido #${pedido.id}</small>
            </div>
            <div style="font-size: 11px; margin-bottom: 10px;">
                <strong>CLIENTE:</strong> ${pedido.cliente}<br>
                <strong>VENDEDOR:</strong> ${pedido.vendedor || '-'}<br>
                <strong>DATA:</strong> ${new Date(pedido.dataFinalizacao || pedido.updatedAt).toLocaleDateString('pt-BR')}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="background: #eee; border-bottom: 1px solid #000;">
                        <th style="text-align: left; padding: 4px;">REF</th>
                        <th>QTD (DZ)</th>
                        <th style="text-align: right;">PREÇO DZ</th>
                        <th style="text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>${itensHtml}</tbody>
            </table>
            <div style="margin-top: 15px; text-align: right; border-top: 2px solid #000; padding-top: 5px;">
                <div style="font-size: 10px; color: #666;">Bruto: ${formatCurrency(brutoRecalculado)}</div>
                ${descPerc > 0 ? `<div style="font-size: 10px; color: #666;">Desconto (${descPerc}%): -${formatCurrency(valorDesconto)}</div>` : ''}
                <div style="font-size: 12px; margin-top: 4px;">TOTAL LÍQUIDO:</div>
                <strong style="font-size: 18px;">${formatCurrency(finalLiquido)}</strong>
            </div>
        </div>`;

    return `<html><body style="margin: 0;">${layoutVia('VIA EMPRESA')}${layoutVia('VIA CLIENTE')}</body></html>`;
}

export { 
    buscarPedidoPorId, 
    buscarProdutoCompleto, 
    criarValePedidoSp, 
    finalizarValePedidoSp,
    listarValesPedidoSp, 
    deletarValePedidoSp, 
    gerarRelatorioRomaneio, 
    gerarRelatorioVale 
};