import { 
    Produto, 
    ProdutoTamanho, 
    EstoqueProduto, 
    OrdemServico, 
    OrdemItem, 
    sequelize 
} from '../src/models/index.js';

const CONF_ID = 1; 
const VALOR_PADRAO_PECAS = 1000;

const refsParaTeste = [
    "230", "240", "20", "23", "260", "280", "285", "290", "295", "320", 
    "323", "328", "329", "330", "337", "338", "339", "340", "341", "512", 
    "530", "56", "600", "610", "730", "735", "740", "745", "750", "760", 
    "765", "770", "780", "790", "795", "840", "880", "890", "900", "100", 
    "1000", "1001", "1002", "1010", "1020", "1100", "1110", "1111", "1120", 
    "1130", "1310", "1320", "1323", "1410", "1500", "1510", "1800", "1801", 
    "1900", "1901", "1913"
];

async function resetEstoqueParaTestes() {
    const t = await sequelize.transaction();
    try {
        console.log("🗑️  Limpando tabelas dependentes (Financeiro)...");
        
        // 1. Limpa o financeiro primeiro para liberar as ordens
        // Usamos query direta caso o modelo Financeiro não esteja importado,
        // ou você pode importar o modelo Financeiro e usar .destroy()
        await sequelize.query('DELETE FROM "financeiro"', { transaction: t });

        console.log("🗑️  Limpando Itens e Ordens...");
        // 2. Agora sim podemos limpar itens e ordens
        await OrdemItem.destroy({ where: {}, transaction: t });
        await OrdemServico.destroy({ where: {}, transaction: t });
        
        console.log(`🚀 Injetando ${VALOR_PADRAO_PECAS} unidades por tamanho...`);

        const osFinalizada = await OrdemServico.create({
            confeccaoId: CONF_ID, 
            status: 'RETORNADA',
            dataInicio: new Date(), 
            dataRetorno: new Date(),
            totalPecasEsperadas: 0, 
            totalPecasReais: 0,
            observacoes: 'RESET DE TESTE - LIMPEZA TOTAL'
        }, { transaction: t });

        let totalGeralPecas = 0;

        for (const ref of refsParaTeste) {
            const produto = await Produto.findOne({ 
                where: { codigo: String(ref) }, 
                transaction: t 
            });

            if (!produto) continue;

            const tamanhos = await ProdutoTamanho.findAll({
                where: { produtoId: produto.id },
                transaction: t
            });

            for (const pt of tamanhos) {
                const qtdPecas = VALOR_PADRAO_PECAS;

                await OrdemItem.create({
                    ordemId: osFinalizada.id, 
                    produtoId: produto.id, 
                    produtoTamanhoId: pt.id,
                    tamanho: pt.tamanho, 
                    volumes: 1, 
                    pecasPorVolume: qtdPecas,
                    pecasEsperadas: 0, 
                    pecasReais: qtdPecas, 
                    corte: 'RESET_PRONTOS'
                }, { transaction: t });

                // Atualiza o estoque diretamente
                const [estoque] = await EstoqueProduto.findOrCreate({
                    where: { produtoTamanhoId: pt.id },
                    defaults: { quantidadeAberta: 0, quantidadePronta: 0 },
                    transaction: t
                });

                await estoque.update({ 
                    quantidadePronta: qtdPecas,
                    quantidadeAberta: 0 
                }, { transaction: t });

                totalGeralPecas += qtdPecas;
            }
        }

        await osFinalizada.update({ totalPecasReais: totalGeralPecas }, { transaction: t });
        
        await t.commit();
        console.log(`✅ Sucesso! Tabelas limpas e estoque resetado para ${VALOR_PADRAO_PECAS}.`);

    } catch (error) {
        if (t) await t.rollback();
        console.error("❌ Erro:", error.message);
    } finally {
        process.exit(0);
    }
}

resetEstoqueParaTestes();