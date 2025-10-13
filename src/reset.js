// src/reset.js
/**
 * Versão para executar a partir de src/ (node reset.js)
 * Mesma ideia: importa dinamicamente src/models/index.js e cria o usuário 'fabio'.
 */

import bcrypt from 'bcrypt';

(async () => {
  try {
    const mod = await import('./models/index.js'); // caminho relativo correto quando executado dentro de src/
    const exportsObj = mod.default ?? mod;
    const { sequelize, User, Role } = exportsObj;

    if (!sequelize || !User || !Role) {
      console.error('Módulo de modelos não expõe sequelize/User/Role. Verifique src/models/index.js');
      process.exit(1);
    }

    const ADMIN_NAME = 'fabio';
    const ADMIN_PASS = '123456';

    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão com DB OK');

    await sequelize.sync({ force: true });
    console.log('Tabelas recriadas.');

    const [adminRole] = await Role.findOrCreate({ where: { nome: 'admin' }, defaults: { nome: 'admin' } });
    const [userRole] = await Role.findOrCreate({ where: { nome: 'user' }, defaults: { nome: 'user' } });

    const senhaHash = await bcrypt.hash(ADMIN_PASS, 10);
    const [fabioUser, created] = await User.findOrCreate({
      where: { nome: ADMIN_NAME },
      defaults: { nome: ADMIN_NAME, senhaHash, roleId: adminRole.id }
    });

    if (!created) {
      fabioUser.senhaHash = senhaHash;
      fabioUser.roleId = adminRole.id;
      await fabioUser.save();
      console.log('Usuário "fabio" existente atualizado.');
    } else {
      console.log('Usuário "fabio" criado.');
    }

    console.log('RESET COMPLETO — login:', { nome: ADMIN_NAME, senha: ADMIN_PASS });

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro no reset do banco:', err);
    try { await (err?.sequelize?.close?.()); } catch(e){}
    process.exit(1);
  }
})();
