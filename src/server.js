// server.js
import './models/index.js';
import express from 'express';
import cors from 'cors';
import os from 'os';
import sequelize from './config/database.js';

import authRoutes from './routes/auth-routes.js';
import usersRoutes from './routes/user-routes.js';
import confeccaoRoutes from './routes/confeccao-routes.js';
import produtoRoutes from './routes/produto-routes.js';
import ordemServicoRoutes from './routes/ordemServico-routes.js';
import materialRoutes from './routes/material-routes.js';
import financeiroRoutes from './routes/financeiro-routes.js';
import estoqueRoutes from './routes/estoque-routes.js';
import movimentacaoRoutes from './routes/movimentacao-material-routes.js';
import cargaRoutes from './routes/carga-routes.js';
import valePedidoSpRoutes from './routes/valePedidoSp-routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  const time = new Date().toISOString();
  console.log(`[REQ] ${time} - ${req.method} ${req.originalUrl}`);
  next();
});

const localIps = Object.values(os.networkInterfaces())
  .flat()
  .filter(iface => iface?.family === 'IPv4' && !iface.internal)
  .map(iface => `http://${iface.address}:4200`);

app.use(cors({
  origin: [
    'http://localhost:4200',
    ...localIps,
    /\.192\.168\.10\.\d{1,3}$/
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/confeccoes', confeccaoRoutes);
app.use('/produtos', produtoRoutes);
app.use('/ordens', ordemServicoRoutes);
app.use('/materiais', materialRoutes);
app.use('/financeiro', financeiroRoutes);
app.use('/estoque', estoqueRoutes);
app.use('/movimentar-estoque', movimentacaoRoutes);
app.use('/cargas', cargaRoutes);
app.use('/vale-pedido-sp', valePedidoSpRoutes);

app.get('/', (req, res) => res.send('API rodando com sucesso'));

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com banco estabelecida.');

    await sequelize.sync({ alter: true });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Acesse: http://localhost:${PORT}`);
      if (localIps.length) {
        console.log(`IPs locais: ${localIps.join(', ')}`);
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
  }
})();
