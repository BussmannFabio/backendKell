// server.js
import express from 'express';
import cors from 'cors';
import sequelize from './config/database.js';

import confeccaoRoutes from './routes/confeccao-routes.js';
import produtoRoutes from './routes/produto-routes.js';
import ordemServicoRoutes from './routes/ordemServico-routes.js';
import materialroutes from './routes/material-routes.js';
import financeiroRoutes from './routes/financeiro-routes.js';
import estoqueRoutes from './routes/estoque-routes.js';

import authRoutes from './routes/auth-routes.js';
import usersRoutes from './routes/user-routes.js';

const app = express();

// === CORS ===
app.use(cors({
  origin: 'http://localhost:4200', // frontend
  methods: ['GET','POST','PATCH','PUT','DELETE'],
  credentials: true
}));

app.use(express.json());

// Rotas públicas e protegidas
app.use('/auth', authRoutes);    // /auth/register, /auth/login
app.use('/users', usersRoutes);  // rotas admin (GET /users, POST /users)

// Rotas da aplicação
app.use('/confeccoes', confeccaoRoutes);
app.use('/produtos', produtoRoutes);
app.use('/ordens', ordemServicoRoutes);
app.use('/materiais', materialroutes);
app.use('/financeiro', financeiroRoutes);
app.use('/estoque', estoqueRoutes);

// healthcheck
app.get('/', (req, res) => res.send('API rodando'));

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com banco OK');
    await sequelize.sync(); // sem force em produção

    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
  }
})();
