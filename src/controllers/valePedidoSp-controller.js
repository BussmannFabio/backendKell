import {
    ValePedidoSp,
    ValePedidoItemSp,
    ProdutoTamanho,
    Produto,
    sequelize,
} from '../models/index.js';

// Assumindo que o 'estoque-controller.js' exporta darBaixaEstoquePadrao E retornarEstoquePadrao
import { darBaixaEstoquePadrao, retornarEstoquePadrao } from './estoque-controller.js';
// Importamos as funções de Baixa e a nova função de Retorno (Estorno) para SP
import { darBaixaEstoqueSp, retornarEstoqueSp } from './carga-controller.js'; 

/* =======================================================================
    🔍 BUSCAR PRODUTO COMPLETO (Produto + Tamanhos)
    ROTA FINAL: GET /vale-pedido-sp/produto/:codigo
======================================================================= */
const buscarProdutoCompleto = async (req, res) => {
    console.log(`[VALE-SP] Buscar produto: ${req.params.codigo}`);

    try {
        const { codigo } = req.params;

        // 1. Buscar o Produto pelo código
        const produto = await Produto.findOne({ where: { codigo } });

        if (!produto) {
            console.log(`[VALE-SP] Produto com código ${codigo} não encontrado.`);
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // 🟢 DEBUG EXTRA: Confirma que o ID é válido antes da próxima consulta
        console.log(`[VALE-SP] ID do Produto Encontrado: ${produto.id}`);

        // 2. Buscar todos os tamanhos associados ao produto.
        const tamanhos = await ProdutoTamanho.findAll({
            where: { produtoId: produto.id }
        });


        console.log(`[VALE-SP] Produto ${codigo} (ID: ${produto.id}) encontrado com ${tamanhos.length} tamanhos.`);

        // 3. Retornar os dados consolidados
        return res.json({
            id: produto.id,
            codigo: produto.codigo,
            descricao: produto.descricao,
            precoVendaPeca: produto.precoVendaPeca,
            precoVendaDuzia: produto.precoVendaDuzia,
            tamanhos // Array de ProdutoTamanhoDTOs
        });

    } catch (error) {
        // ❌ LOG CRÍTICO PARA CAPTURAR ERROS DO SEQUELIZE
        console.error('❌ ERRO CRÍTICO buscarProdutoCompleto:', error.stack || error);

        // Retorna 500 se o backend falhar (ex: erro de DB)
        res.status(500).json({
            error: 'Erro interno ao buscar produto',
            detalhe: error.message
        });
    }
}

/* =======================================================================
    📝 CRIAR VALE PEDIDO SP (com transação e BAIXA DE ESTOQUE)
======================================================================= */
const criarValePedidoSp = async (req, res) => {
    console.log(`[VALE-SP] Criando vale…`);
    
    const {
        cliente,
        endereco,
        vendedor,
        parcelas,
        dataInicialPagamento,
        cidadeSeparacao,
        valorBruto,
        descontoPorcento,
        precoTotal,
        volumes
    } = req.body || {};

    let itens = req.body?.itens ?? req.body?.items;

    if (typeof itens === 'string') {
        try {
            itens = JSON.parse(itens);
        } catch (err) {
            console.warn('[VALE-SP] Falha ao parsear itens stringificados:', err.message);
        }
    }

    if (!cliente || !endereco) {
        return res.status(400).json({ error: 'cliente e endereco são obrigatórios' });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
        console.error('[VALE-SP] Payload inválido: "itens" vazio ou não é array');
        return res.status(400).json({ error: 'Adicione ao menos um item válido ao pedido' });
    }

    const t = await sequelize.transaction();

    try {
        // 1. Criação do Vale Pedido
        const vale = await ValePedidoSp.create(
            {
                cliente,
                endereco,
                vendedor,
                parcelas,
                dataInicialPagamento,
                cidadeSeparacao,
                valorBruto: typeof valorBruto !== 'undefined' ? valorBruto : null,
                descontoPorcento: typeof descontoPorcento !== 'undefined' ? descontoPorcento : null,
                precoTotal: typeof precoTotal !== 'undefined' ? precoTotal : null,
                volumes: typeof volumes !== 'undefined' ? volumes : null
            },
            { transaction: t }
        );

        // Array de itens formatados para o banco de dados (e para baixa de estoque)
        const itensParaBaixa = [];

        for (const item of itens) {
            if (!item || (typeof item.produtoTamanhoId !== 'number')) {
                throw new Error('Item inválido: produtoTamanhoId ausente ou não é número');
            }

            const quantidade = Number(item.quantidade) || 0;
            const precoUnitario = Number(item.precoUnitario) || 0;
            const subtotal = Number(item.subtotal) || Number((quantidade * precoUnitario).toFixed(2));

            // Cria o item no banco de dados
            await ValePedidoItemSp.create(
                {
                    valePedidoSpId: vale.id,
                    produtoTamanhoId: item.produtoTamanhoId,
                    quantidade, // Quantidade em DÚZIA
                    precoUnitario,
                    subtotal
                },
                { transaction: t }
            );

            // Coleta os dados para a baixa de estoque
            itensParaBaixa.push({
                produtoTamanhoId: item.produtoTamanhoId,
                quantidade: quantidade // Quantidade em DÚZIA
            });
        }

        // 2. Lógica Condicional da Baixa de Estoque
        if (itensParaBaixa.length > 0) {
            
            // Normaliza a string da cidade removendo espaços e comparando em maiúsculas
            const cidadeNormalizada = cidadeSeparacao?.toUpperCase()?.trim();
            
            const isEstoqueSp = cidadeNormalizada === 'SÃO PAULO' || cidadeNormalizada === 'SP';

            if (isEstoqueSp) {
                console.log(`[BAIXA OK] Selecionado ESTOQUE SP (Carga) para o Pedido #${vale.id}`);
                await darBaixaEstoqueSp(itensParaBaixa, t); 
                
            } else if (cidadeNormalizada === 'GUARATINGUETÁ' || cidadeNormalizada === 'GUA') {
                console.log(`[BAIXA OK] Selecionado ESTOQUE PADRÃO (Guaratinguetá) para o Pedido #${vale.id}`);
                await darBaixaEstoquePadrao(itensParaBaixa, t); 
                
            } else {
                 console.warn(`[BAIXA ALERTA] Cidade de separação '${cidadeSeparacao}' não reconhecida. Nenhuma baixa de estoque aplicada.`);
            }
        } else {
            console.warn(`[BAIXA ALERTA] Pedido #${vale.id} criado SEM itens para baixa.`);
        }


        await t.commit();

        console.log(`[VALE-SP] Vale registrado e Estoque debitado #${vale.id}`);
        return res.json({ message: 'Vale registrado e Estoque debitado!', id: vale.id });

    } catch (error) {
        await t.rollback();
        console.error('Erro criarValePedidoSp:', error);

        let errorMessage = error.message;
        
        if (errorMessage.includes('Estoque insuficiente') || errorMessage.includes('não encontrado')) {
            // Mantém a mensagem detalhada se vier da função de baixa de estoque
        } else {
            errorMessage = 'Erro ao criar vale e dar baixa no estoque';
        }

        return res.status(500).json({ error: errorMessage, detalhe: error.message });
    }
}

/* =======================================================================
    📋 LISTAR VALES
======================================================================= */
const listarValesPedidoSp = async (req, res) => {
    console.log('[VALE-SP] Listando vales…');

    try {
        const vales = await ValePedidoSp.findAll({
            // Selecionamos apenas os campos necessários para a listagem inicial do frontend
            attributes: ['id', 'cliente', 'precoTotal', 'createdAt'],
            order: [['id', 'DESC']]
        });

        return res.json(vales ?? []);

    } catch (error) {
        console.error('Erro listarValesPedidoSp:', error);
        res.status(500).json({ error: 'Erro ao listar vales', detalhe: error.message });
    }
}

/* =======================================================================
    🗑️ DELETAR VALE (Com Retorno de Estoque - Estratégia Duas Buscas)
======================================================================= */
const deletarValePedidoSp = async (req, res) => {
    const { id } = req.params;

    console.log(`[VALE-SP] Deletando vale #${id} e estornando estoque...`);

    try {
        await sequelize.transaction(async (t) => {
            
            // 1. BUSCAR E TRAVAR APENAS O VALE PRINCIPAL
            const vale = await ValePedidoSp.findByPk(id, {
                transaction: t, 
                lock: t.LOCK.UPDATE // Trava a tabela ValePedidoSp
            });

            if (!vale) {
                return res.status(404).json({ error: 'Vale pedido não encontrado para exclusão' });
            }
            
            // 2. BUSCAR ITENS SEPARADAMENTE (sem lock de JOIN, que causava o erro anterior)
            const itensDoVale = await ValePedidoItemSp.findAll({
                where: { valePedidoSpId: id },
                attributes: ['produtoTamanhoId', 'quantidade'], // ID do produto e a quantidade (dúzia)
                transaction: t // Inclui na transação
            });
            
            // 3. Coletar itens para estorno
            const itensParaRetorno = itensDoVale.map(item => ({
                produtoTamanhoId: item.produtoTamanhoId,
                quantidade: item.quantidade // Quantidade em DÚZIA
            }));

            // 4. Lógica de Estorno de Estoque
            if (itensParaRetorno.length > 0) {
                const cidadeSeparacao = vale.cidadeSeparacao;
                const cidadeNormalizada = cidadeSeparacao?.toUpperCase()?.trim();
                
                const isEstoqueSp = cidadeNormalizada === 'SÃO PAULO' || cidadeNormalizada === 'SP';

                if (isEstoqueSp) {
                    console.log(`[ESTORNO OK] Retornando itens para ESTOQUE SP.`);
                    // A função retornarEstoqueSp lida com o lock dentro dela
                    await retornarEstoqueSp(itensParaRetorno, t); 
                } else {
                    console.log(`[ESTORNO OK] Retornando itens para ESTOQUE PADRÃO (Guaratinguetá).`);
                    // A função retornarEstoquePadrao lida com o lock dentro dela
                    await retornarEstoquePadrao(itensParaRetorno, t); 
                }
            } else {
                 console.warn(`[ESTORNO ALERTA] Pedido #${id} não tinha itens para estornar o estoque.`);
            }

            // 5. Deletar os itens e o vale principal (DEPOIS de estornar o estoque)
            await ValePedidoItemSp.destroy({ where: { valePedidoSpId: id }, transaction: t });
            await ValePedidoSp.destroy({ where: { id }, transaction: t });
            
            console.log(`[VALE-SP] Vale #${id} deletado e estoque estornado com sucesso.`);
        });

        res.json({ message: 'Vale deletado e estoque estornado com sucesso!' });

    } catch (error) {
        // O rollback é tratado implicitamente pelo sequelize.transaction se houver erro
        console.error('Erro deletarValePedidoSp e estorno de estoque:', error);
        res.status(500).json({ error: 'Erro ao deletar vale e estornar estoque', detalhe: error.message });
    }
}


/* =======================================================================
    📄 GERAR RELATÓRIO (FORMATO 1/4 A4 E DUAS VIAS)
======================================================================= */
const gerarRelatorioValePedido = async (req, res) => {
    const pedidoId = req.params.id;
    console.log(`[RELATORIO] Tentativa de geração para o Pedido ID: ${pedidoId}`);

    try {
        // 1. Buscar o pedido principal com todos os detalhes aninhados
        const pedido = await ValePedidoSp.findByPk(pedidoId, {
            include: [
                {
                    model: ValePedidoItemSp,
                    as: 'itens',
                    required: true,
                    include: [
                        {
                            model: ProdutoTamanho,
                            as: 'produtoTamanho',
                            include: [
                                {
                                    model: Produto,
                                    as: 'produto'
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!pedido) {
            console.warn(`[RELATORIO] Pedido #${pedidoId} não encontrado.`);
            return res.status(404).json({ error: `Pedido #${pedidoId} não encontrado.` });
        }

        // 2. Montar o HTML do Relatório (Duas Vias, 1/4 A4)
        const htmlRelatorio = criarTemplateHtmlRelatorio(pedido);

        // 3. Enviar o HTML
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="relatorio-pedido-${pedidoId}.html"`);

        return res.status(200).send(htmlRelatorio);

    } catch (error) {
        console.error(`Erro gerarRelatorioValePedido #${pedidoId}:`, error);
        return res.status(500).send({ message: 'Falha interna ao gerar o relatório.', detalhe: error.message });
    }
}

/**
 * Função utilitária para montar a estrutura HTML do relatório (DUAS VIAS, 1/4 A4)
 * @param {object} pedido Objeto ValePedidoSp com seus includes
 * @returns {string} O HTML completo
 */
function criarTemplateHtmlRelatorio(pedido) {
    const formatDate = (date) => new Date(date).toLocaleDateString('pt-BR');

    const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatCurrency = (value) => currencyFormatter.format(value);

    let itensHtml = '';

    // Agrupamento por Código (Produto), somando a quantidade total de dúzias e subtotais
    const agrupadoPorCodigo = pedido.itens.reduce((acc, item) => {
        if (!item || !item.produtoTamanho || !item.produtoTamanho.produto) {
            console.error('Item inválido encontrado durante a agregação:', item);
            return acc;
        }

        const codigo = item.produtoTamanho.produto.codigo;

        const quantidade = Number(item.quantidade) || 0;
        const subtotal = Number(item.subtotal) || 0;

        if (!acc[codigo]) {
            acc[codigo] = {
                codigo: codigo,
                // Assumimos que o preço unitário da dúzia é o mesmo para todos os tamanhos do mesmo código
                // Preço unitário (peça) * 12
                precoUnitarioDuzia: (Number(item.precoUnitario) * 12) || 0,
                subtotal: 0,
                totalQuantidade: 0
            };
        }

        acc[codigo].totalQuantidade += quantidade;
        acc[codigo].subtotal += subtotal;

        return acc;
    }, {});

    Object.values(agrupadoPorCodigo).forEach(item => {
        // Agora com Preço Dúzia
        itensHtml += `
            <tr>
                <td>${item.codigo}</td>
                <td style="text-align: right;">${item.totalQuantidade}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitarioDuzia)}</td>
                <td style="text-align: right;">${formatCurrency(item.subtotal)}</td>
            </tr>
        `;
    });

    // --- TEMPLATE PRINCIPAL PARA REPETIÇÃO ---
    const templateRelatorio = (via) => `
        <div class="relatorio-via">
            <h1 class="via-titulo">VALE PEDIDO #${pedido.id} (${via})</h1>
            
            <div class="header-container">
                <div class="client-info header-info">
                    <div><strong>Cliente:</strong> ${pedido.cliente}</div>
                    <div><strong>Endereço:</strong> ${pedido.endereco}</div>
                    <div><strong>Vendedor:</strong> ${pedido.vendedor || 'N/A'}</div>
                </div>
                <div class="order-info header-info">
                    <div><strong>Emissão:</strong> ${formatDate(pedido.createdAt)}</div>
                    <div><strong>Pagamento:</strong> ${formatDate(pedido.dataInicialPagamento)} (${pedido.parcelas}x)</div>
                    <div><strong>Separação:</strong> ${pedido.cidadeSeparacao}</div>
                </div>
            </div>
            <div class="separator-line"></div>

            <h2>ITENS (Agrupado)</h2>
            <table class="itens-table">
                <thead>
                    <tr>
                        <th style="width: 20%;">Cód.</th>
                        <th style="width: 30%; text-align: right;">Qtd. Total (Dz.)</th>
                        <th style="width: 30%; text-align: right;">Preço Dúzia</th>
                        <th style="width: 20%; text-align: right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itensHtml}
                </tbody>
            </table>

            <div class="totals">
                <div><span>Volumes Totais (Dúzias):</span> <strong>${pedido.volumes || 0}</strong></div>
                <div><span>Desconto (${pedido.descontoPorcento || 0}%):</span> ${formatCurrency(pedido.valorBruto * (pedido.descontoPorcento / 100) || 0)}</div>
                <div class="total-final"><span>TOTAL A PAGAR:</span> ${formatCurrency(pedido.precoTotal || 0)}</div>
            </div>
            
            <div class="separador-assinatura">___________________________<br>Assinatura Cliente</div>
        </div>
    `;


    // --- ESTRUTURA FINAL COM DUAS VIAS E CSS PARA IMPRESSÃO ---
    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Vale Pedido #${pedido.id} - Duas Vias Quadrado</title>
            <style>
                /* Estilo base para visualização na tela */
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 8px; }
                
                /* Estilo da Via na tela */
                .relatorio-via {
                    box-sizing: border-box;
                    padding: 5px;
                    border: 1px solid #ccc;
                    margin: 5px; 
                    overflow: hidden;
                    width: 48%; /* Duas vias lado a lado na tela */
                    float: left; 
                    min-height: 40vh;
                }

                .via-titulo { font-size: 11px; color: #0056b3; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 4px; text-align: center; }
                h2 { font-size: 9px; margin-top: 4px; margin-bottom: 3px; }

                /* Header (2 colunas) */
                .header-container { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .client-info, .order-info { width: 49%; font-size: 7px; }
                .header-info div { margin-bottom: 1px; }

                /* Tabela de Itens compacta */
                .itens-table { width: 100%; border-collapse: collapse; margin-top: 3px; font-size: 7px; }
                .itens-table th, .itens-table td { border: 1px solid #ddd; padding: 1px 3px; text-align: left; }
                .itens-table th { background-color: #f2f2f2; font-weight: bold; }
                
                /* Totais */
                .totals { margin-top: 5px; width: 100%; font-size: 8px; }
                .totals div { display: flex; justify-content: space-between; margin-bottom: 1px; }
                .total-final { font-weight: bold; font-size: 1.0em; color: #d9534f; border-top: 1px solid #000; padding-top: 1px; margin-top: 2px; }
                
                .separador-assinatura { text-align: center; margin-top: 10px; font-size: 8px; }
                .separator-line { border-bottom: 1px dashed #ccc; margin: 2px 0; }

                /* =======================================================
                    CSS para Impressão (DUAS VIAS LADO A LADO NA A4)
                    ======================================================= */
                @media print {
                    @page { margin: 0.5cm; size: A4; }
                    
                    body { margin: 0; padding: 0; font-size: 8px; }
                    
                    .relatorio-via {
                        /* Força as duas vias a ficarem lado a lado na A4 (formato quadrado) */
                        width: 49%; 
                        float: left;
                        box-sizing: border-box;
                        padding: 5px;
                        border: 1px solid #000; /* Borda para separar as duas vias impressas */
                        margin: 0.1cm;
                        height: auto; 
                    }
                    
                    /* Opcional: Limpa o float após o último item para evitar problemas */
                    body::after {
                        content: "";
                        display: table;
                        clear: both;
                    }
                }

            </style>
        </head>
        <body>
            ${templateRelatorio('VIA 1 - CLIENTE')}
            ${templateRelatorio('VIA 2 - SEPARAÇÃO')}
        </body>
        </html>
    `;

    return html;
}

// ⚠️ EXPORTS FINAIS:
export {
    buscarProdutoCompleto,
    criarValePedidoSp,
    listarValesPedidoSp,
    deletarValePedidoSp,
    gerarRelatorioValePedido
};