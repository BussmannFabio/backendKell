import sequelize from './config/database.js';
import Confeccao from './models/confeccao-model.js';
import Produto from './models/produto-model.js';
import OrdemServico from './models/ordemServico-model.js';
import OrdemItem from './models/ordemItem-model.js';
import Financeiro from './models/financeiro-model.js';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão OK');


    await OrdemServico.sync({ force: true });
    await OrdemItem.sync({ force: true });
    await Financeiro.sync({ force: true });

    console.log('Banco zerado e tabelas recriadas');
  } catch (err) {
    console.error('Erro ao resetar banco:', err);
  } finally {
    await sequelize.close();
  }
})();
