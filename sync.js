// sync.js

import { sequelize } from "./src/models/index.js"; // Importa a instância do Sequelize
// Não é necessário importar os models individualmente,
// pois importá-los no index.js já os registra na instância 'sequelize'.

console.log("\n=====================================");
console.log("  INICIANDO SINCRONIZAÇÃO DAS TABELAS");
console.log("=====================================\n");

async function syncModels() {
    try {
        // A função sequelize.sync() sincroniza *todos* os models que foram definidos
        // e registrados na instância 'sequelize'.
        
        // Usamos 'alter: true' para adicionar as novas colunas (createdAt/updatedAt)
        // sem destruir os dados existentes nas tabelas.
        await sequelize.sync({ 
            alter: true, 
            logging: (msg) => console.log(`[Sequelize] ${msg}`) // Opcional: para ver o SQL gerado
        });

        console.log("\n=====================================");
        console.log("   TODAS AS TABELAS FORAM SINCRONIZADAS!");
        console.log("   (Novas colunas 'createdAt' e 'updatedAt' adicionadas)");
        console.log("=====================================\n");

        process.exit(0);

    } catch (err) {
        console.error("\n❌ ERRO AO SINCRONIZAR TABELAS:\n", err);
        process.exit(1);
    }
}

syncModels();