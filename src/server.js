import express from 'express';
import cors from 'cors'; // <<< IMPORTAR CORS
import sequelize from './config/database.js';

import confeccaoRoutes from './routes/confeccao-routes.js';
import produtoRoutes from './routes/produto-routes.js';
import ordemServicoRoutes from './routes/ordemServico-routes.js';
import materialroutes from './routes/material-routes.js';
import financeiroRoutes from './routes/financeiro-routes.js';

const app = express();

// === LIBERAR CORS ===
app.use(cors({
  origin: 'http://localhost:4200', // substitua pelo domínio do seu frontend
  methods: ['GET','POST','PATCH','PUT','DELETE'], // métodos que quer liberar
  credentials: true // caso queira enviar cookies
}));

app.use(express.json());

// Rotas
app.use('/confeccoes', confeccaoRoutes);
app.use('/produtos', produtoRoutes);
app.use('/ordens', ordemServicoRoutes);
app.use('/materiais', materialroutes);    
app.use('/financeiro', financeiroRoutes);

const PORT = 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com banco OK');
    await sequelize.sync(); // sem force no servidor normal

    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
  }
})();
