import { Produto, ProdutoTamanho, sequelize } from '../src/models/index.js';
import { QueryTypes } from 'sequelize';

const cargaEstoque = [
    // CAPITANI
    { ref: "295", valorU: 35 },
    { ref: "280", tamanhos: { "P": 107, "M": 226, "G": 184 } },
    { ref: "341", tamanhos: { "P": 79, "M": 87, "G": 93 } },
    { ref: "890", valorU: 45 },
    { ref: "880", tamanhos: { "P": 36, "M": 146, "G": 212 } },
    { ref: "320", tamanhos: { "P": 71, "M": 51, "G": 110 } },
    { ref: "530", valorU: 38 },
    { ref: "290", tamanhos: { "P": 67, "M": 102, "G": 54 } },
    { ref: "512", valorU: 25 },
    { ref: "340", tamanhos: { "P": 82, "M": 82, "G": 79 } },
    { ref: "1500", tamanhos: { "P": 102, "M": 61, "G": 70 } },
    { ref: "285", valorU: 67 },

    // LA BELLA MARI
    { ref: "1000", tamanhos: { "P": 18, "M": 18, "G": 15 } },
    { ref: "760", tamanhos: { "P": 40, "M": 73, "G": 209 } },
    { ref: "750", valorU: 124 },
    { ref: "770", tamanhos: { "P": 51, "M": 57, "G": 48 } },
    { ref: "780", valorU: 69 },
    { ref: "790", valorU: 32 },
    { ref: "795", valorU: 59 },
    { ref: "765", valorU: 61 },
    { ref: "740", tamanhos: { "P": 129, "M": 86, "G": 81 } },
    { ref: "1010", valorU: 19 },
    { ref: "1020", tamanhos: { "P": 31, "M": 4, "G": 0 } },
    { ref: "730", tamanhos: { "P": 45, "M": 62, "G": 66 } },
    { ref: "735", valorU: 116 },
    { ref: "1310", tamanhos: { "P": 19, "M": -11, "G": -17 }, valorU: -36 }, 
    { ref: "1410", tamanhos: { "P": 74, "M": 26, "G": 34 }, valorU: 31 },
    { ref: "745", valorU: 116 },

    // NANA
    { ref: "900", tamanhos: { "P": 40, "M": 32, "G": 32 } },
    { ref: "840", valorU: 88 },
    { ref: "20", tamanhos: { "P": 73, "M": 2, "G": 5 } },
    { ref: "21", tamanhos: { "P": 0, "M": 0, "G": 0 }, valorU: 0 },
    { ref: "26", tamanhos: { "P": 0, "M": 0, "G": 0 }, valorU: 0 },

    // SILMARA
    { ref: "1320", tamanhos: { "P": 73, "M": 110, "G": 115 } },
    { ref: "240", valorU: 82 },
    { ref: "230", tamanhos: { "P": 56, "M": 70, "G": 60 } },
    { ref: "1323", tamanhos: { "P": 36, "M": 52, "G": 52 } },
    { ref: "23", tamanhos: { "P": 140, "M": 226, "G": 178 } },
    { ref: "338", tamanhos: { "P": 67, "M": 25, "G": 74 } },
    { ref: "328", tamanhos: { "P": 44, "M": 60, "G": 86 } },
    { ref: "329", valorU: 52 },
    { ref: "323", tamanhos: { "P": 46, "M": 80, "G": 87 } },
    { ref: "600", tamanhos: { "P": 112, "M": 50, "G": 44 } },
    { ref: "610", valorU: 61 },
    { ref: "260", valorU: 40 },
    { ref: "339", valorU: 43 },
    { ref: "330", valorU: 50 },
    { ref: "56", valorU: 25 },
    { ref: "337", valorU: 32 },

    // SILMARINHA
    { ref: "1801", tamanhos: { "P": 2, "M": 0, "G": 3 }, valorU: 12 },
    { ref: "1900", tamanhos: { "P": 38, "M": 38, "G": 38 }, valorU: 38 },
    { ref: "1510", tamanhos: { "P": 33, "M": 49, "G": 46 }, valorU: 51 },
    { ref: "1901", tamanhos: { "P": 36, "M": 37, "G": 36 }, valorU: 38 },
    { ref: "1800", tamanhos: { "P": 4, "M": 10, "G": 18 }, valorU: 14 },
    { ref: "1110", tamanhos: { "P": 98, "M": 120, "G": 65 } },
    { ref: "1100", tamanhos: { "P": 42, "M": 9, "G": 38 } },
    { ref: "1120", tamanhos: { "P": 166, "M": 168, "G": 158 } },
    { ref: "1130", tamanhos: { "P": 111, "M": 102, "G": 153 } },
    { ref: "1111", valorU: 17 },
    { ref: "1913", valorU: 25 },
    { ref: "100", tamanhos: { "P": 68, "M": 52, "G": 55 } },
    { ref: "1001", valorU: 78 },
    { ref: "1002", valorU: 119 }
];

async function salvarEstoqueNoBanco(ptId, qtdUnidades, t) {
    // Agora aceita negativos (removido Math.max)
    const qtdFinal = isNaN(qtdUnidades) ? 0 : Math.floor(qtdUnidades); 

    const [estoqueExistente] = await sequelize.query(
        `SELECT id FROM "estoques_sp" WHERE "produtoTamanhoId" = :ptId LIMIT 1`,
        { replacements: { ptId }, type: QueryTypes.SELECT, transaction: t }
    );

    if (estoqueExistente) {
        await sequelize.query(
            `UPDATE "estoques_sp" SET "quantidade" = :qtd, "updatedAt" = NOW() WHERE "id" = :id`,
            { replacements: { id: estoqueExistente.id, qtd: qtdFinal }, type: QueryTypes.UPDATE, transaction: t }
        );
    } else {
        await sequelize.query(
            `INSERT INTO "estoques_sp" ("produtoTamanhoId", "quantidade", "estoqueMinimo", "createdAt", "updatedAt") 
             VALUES (:ptId, :qtd, 0, NOW(), NOW())`,
            { replacements: { ptId, qtd: qtdFinal }, type: QueryTypes.INSERT, transaction: t }
        );
    }
}

async function executarCargaEstoque() {
    console.log("--- 🚀 INICIANDO CARGA (PERMITINDO NEGATIVOS) ---");
    const t = await sequelize.transaction();

    try {
        // Tenta remover restrições comuns que impedem números negativos
        // e garante as colunas necessárias
        await sequelize.query(`
            ALTER TABLE "estoques_sp" 
            ADD COLUMN IF NOT EXISTS "estoqueMinimo" INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

            -- Remove restrição de CHECK se ela existir (comum em bancos que travam negativos)
            DO $$ 
            BEGIN 
                ALTER TABLE "estoques_sp" DROP CONSTRAINT IF EXISTS estoques_sp_quantidade_check;
            END $$;
        `, { transaction: t });

        console.log("🧹 Zerando estoques anteriores...");
        await sequelize.query('UPDATE "estoques_sp" SET "quantidade" = 0', { transaction: t });

        for (const item of cargaEstoque) {
            console.log(`\n🔎 Processando REF: ${item.ref}...`);

            const produto = await Produto.findOne({ 
                where: { codigo: String(item.ref) },
                transaction: t 
            });

            if (!produto) {
                console.error(`❌ ERRO: REF ${item.ref} não encontrada.`);
                continue;
            }

            if (item.tamanhos) {
                for (const [tam, qtd] of Object.entries(item.tamanhos)) {
                    const [pt] = await ProdutoTamanho.findOrCreate({
                        where: { produtoId: produto.id, tamanho: tam },
                        defaults: { produtoId: produto.id, tamanho: tam },
                        transaction: t
                    });
                    const total = (Number(qtd) || 0) * 12;
                    await salvarEstoqueNoBanco(pt.id, total, t);
                    console.log(`   ✅ Grade ${tam}: ${total} unidades.`);
                }
            }

            if (item.valorU !== undefined) {
                const possiveisUnicos = ["U", "14", "MM", "JV", "GG", "EG", "UNICO", "ÚNICO", "1", "UN"];
                let ptU = await ProdutoTamanho.findOne({
                    where: { produtoId: produto.id, tamanho: possiveisUnicos },
                    transaction: t
                });

                if (!ptU) {
                    ptU = await ProdutoTamanho.create({
                        produtoId: produto.id,
                        tamanho: "U"
                    }, { transaction: t });
                }

                const totalU = (Number(item.valorU) || 0) * 12;
                await salvarEstoqueNoBanco(ptU.id, totalU, t);
                console.log(`   ✅ Único (${ptU.tamanho}): ${totalU} unidades.`);
            }
        }

        await t.commit();
        console.log("\n--- 🏁 SUCESSO! NEGATIVOS APLICADOS SE HOUVER ---");
        
    } catch (error) {
        await t.rollback();
        console.error("\n💥 ERRO CRÍTICO:", error.message);
    } finally {
        process.exit(0);
    }
}

executarCargaEstoque();