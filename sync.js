import { sequelize, EstoqueMaterial, EstoqueProduto, Material, ProdutoTamanho } from './src/models/index.js';

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco estabelecida com sucesso!');

    // Cria ou atualiza todas as tabelas
    await sequelize.sync({ alter: true }); // 'alter' atualiza tabelas existentes sem perder dados

    console.log('Tabelas sincronizadas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao sincronizar o banco:', error);
    process.exit(1);
  }
}

syncDatabase();
