// src/sync-material.js
import { sequelize, Material } from './models/index.js';

(async () => {
  try {
    // Sincroniza apenas o model Material
    await Material.sync({ alter: true }); // ajusta a tabela conforme o model
    console.log('Tabela Material atualizada com sucesso!');

    // Teste: listar todos os materiais
    const materiais = await Material.findAll({ raw: true });
    console.log('Materiais existentes:', materiais);
  } catch (err) {
    console.error('Erro ao sincronizar Material:', err);
  } finally {
    await sequelize.close();
  }
})();
