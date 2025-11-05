// src/reset.js
import bcrypt from 'bcrypt';
import { sequelize, User, Role } from './models/index.js';

(async () => {
  try {
    console.log('🧹 Resetando banco de dados...');

    // 1. Dropa e recria todas as tabelas
    await sequelize.sync({ force: true });
    console.log('✅ Todas as tabelas foram recriadas.');

    // 2. Recria papéis
    const [adminRole] = await Role.findOrCreate({
      where: { nome: 'admin' },
      defaults: { nome: 'admin' }
    });

    const [userRole] = await Role.findOrCreate({
      where: { nome: 'user' },
      defaults: { nome: 'user' }
    });

    // 3. Cria usuário padrão
    const ADMIN_NAME = 'fabio';
    const ADMIN_PASS = '123456';
    const senhaHash = await bcrypt.hash(ADMIN_PASS, 10);

    const fabio = await User.create({
      nome: ADMIN_NAME,
      senhaHash,
      roleId: adminRole.id
    });

    console.log(`👤 Usuário padrão criado: ${fabio.nome} / ${ADMIN_PASS}`);

    // 4. Finaliza
    await sequelize.close();
    console.log('🏁 Reset completo. Banco pronto para uso.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao resetar banco:', err);
    process.exit(1);
  }
})();
