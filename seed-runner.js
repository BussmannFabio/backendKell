// seed-runner.js
import bcrypt from 'bcryptjs'; // Usa sintaxe ESM
import sequelize from './src/config/database.js'; // Sua conexão Sequelize ativa
import User from './src/models/user-model.js'; // Importa seu modelo User
import Role from './src/models/role-model.js'; // Importa seu modelo Role
// Nota: Verifique se os caminhos de importação estão corretos para seus modelos.

console.log("=====================================");
console.log("  INICIANDO SCRIPT DE SEED MANUAL");
console.log("=====================================");

async function runSeed() {
    try {
        // --- 1. Conectar e Sincronizar (Garantir que as tabelas existam) ---
        // Usamos { alter: true } para adicionar colunas se necessário, mas não recriar tudo.
        await sequelize.sync({ alter: true }); 
        console.log("✅ Conexão estabelecida e tabelas verificadas.");

        // 2. Criptografia da Senha Padrão
        const saltRounds = 10;
        const senhaHash = await bcrypt.hash('123456', saltRounds); 
        console.log("✅ Senha padrão criptografada.");

        // 3. Definição da Lista de Usuários
        const adminNames = ['keila', 'giovana', 'fabio', 'jacob', 'admin1', 'admin2'];
        const userNames = ['elvio', 'carlos', 'user1', 'user2', 'user3'];

        const usuariosParaInserir = [];

        // Note que não adicionamos 'createdAt'/'updatedAt' aqui, o Sequelize faz isso.
        adminNames.forEach(nome => {
            usuariosParaInserir.push({ nome, senhaHash, roleId: 1 });
        });
        userNames.forEach(nome => {
            usuariosParaInserir.push({ nome, senhaHash, roleId: 2 });
        });

        // 4. Inserção das Roles (Corrigido: Apenas ignoreDuplicates)
        console.log('Populando roles...');
        await Role.bulkCreate([
            { id: 1, nome: 'admin' },
            { id: 2, nome: 'user' }
        ], { 
            ignoreDuplicates: true // <-- CORREÇÃO: Apenas ignora se já existirem
        });
        console.log('✅ Roles inseridas.');


        // 5. Inserção dos Usuários
        console.log('Populando usuarios...');
        await User.bulkCreate(usuariosParaInserir, {
            ignoreDuplicates: true // <-- CORREÇÃO: Apenas ignora se já existirem
        });
        console.log('✅ Todos os usuários padrão inseridos com sucesso!');

    } catch (error) {
        console.error("❌ ERRO NO SCRIPT DE SEEDING:", error);
    } finally {
        await sequelize.close();
        console.log("=====================================");
        console.log("  SCRIPT FINALIZADO.");
        console.log("=====================================");
    }
}

runSeed();