// scripts/zerarBanco.js
/**
 * Zera o banco: recria todas as tabelas (force: true) e cria roles + admin.
 *
 * Uso: node scripts/zerarBanco.js
 *
 * ATENÇÃO: apaga todos os dados!
 */

import bcrypt from 'bcrypt';
import { sequelize, User, Role } from '../src/models/index.js';

const ADMIN_NAME = 'admin';
const ADMIN_PASS = '123456'; // troque aqui se quiser outra senha

(async () => {
  try {
    console.log('>>> Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão com DB OK');

    console.log('>>> Drop & recreate: sincronizando modelos (force: true) — todas tabelas serão recriadas');
    await sequelize.sync({ force: true });
    console.log('Tabelas recriadas com sucesso.');

    // Criar roles padrão
    console.log('>>> Criando roles padrão (admin, user)');
    const [adminRole] = await Role.findOrCreate({
      where: { nome: 'admin' },
      defaults: { nome: 'admin' }
    });
    const [userRole] = await Role.findOrCreate({
      where: { nome: 'user' },
      defaults: { nome: 'user' }
    });
    console.log('Roles confirmadas:', { adminRoleId: adminRole.id, userRoleId: userRole.id });

    // Criar/atualizar usuário admin
    console.log(`>>> Criando/atualizando usuário "${ADMIN_NAME}" com senha "${ADMIN_PASS}"`);
    const senhaHash = await bcrypt.hash(ADMIN_PASS, 10);

    const [adminUser, created] = await User.findOrCreate({
      where: { nome: ADMIN_NAME },
      defaults: { nome: ADMIN_NAME, senhaHash, roleId: adminRole.id }
    });

    if (!created) {
      // já existia — atualiza senha e role
      adminUser.senhaHash = senhaHash;
      adminUser.roleId = adminRole.id;
      await adminUser.save();
      console.log('Usuário admin atualizado (senha sobrescrita).');
    } else {
      console.log('Usuário admin criado.');
    }

    console.log('>>> RESET COMPLETO. Acesse com:', { nome: ADMIN_NAME, senha: ADMIN_PASS });
  } catch (err) {
    console.error('Erro no reset do banco:', err);
    process.exitCode = 1;
  } finally {
    try { await sequelize.close(); } catch (e) {}
    // encerra o processo explicitamente
    process.exit();
  }
})();
