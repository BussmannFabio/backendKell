// src/server.js
import os from 'os';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Importação do banco e modelos
import './models/index.js';
import sequelize from './config/database.js';

// Importação de todas as rotas
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
import clienteRoutes from './routes/clientes-routes.js';
import vendedorRoutes from './routes/vendedor-routes.js';

const app = express();

// Mudamos para 3001 para desvencilhar do erro de porta presa no Windows
const PORT = Number(process.env.PORT) || 3001; 

/* ===================== CONFIGURAÇÕES BÁSICAS ===================== */
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ===================== LOG DE REQUISIÇÕES ===================== */
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
});

/* ===================== ROTAS DE TESTE ===================== */
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (req, res) => res.send('🚀 Backend Kell está Online na Porta 3001!'));

/* ===================== DEFINIÇÃO DAS ROTAS ===================== */
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
app.use('/clientes', clienteRoutes);
app.use('/vendedores', vendedorRoutes);

/* ===================== FUNÇÃO DE INICIALIZAÇÃO ===================== */
async function startServer() {
    try {
        console.log('--- [SISTEMA] CONECTANDO AO BANCO DE DADOS... ---');
        await sequelize.authenticate();
        console.log('✅ Banco de Dados conectado com sucesso.');

        const server = app.listen(PORT, '0.0.0.0', () => {
            // Detecção do IP da nova rede (Cabo/Ethernet)
            const interfaces = os.networkInterfaces();
            let networkIp = 'localhost';
            
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        networkIp = iface.address;
                    }
                }
            }

            console.log(`\n==========================================`);
            console.log(`🚀 SERVIDOR ONLINE - MODO REDE ATIVADO`);
            console.log(`🏠 LOCAL: http://localhost:${PORT}`);
            console.log(`🌐 REDE:  http://${networkIp}:${PORT}`);
            console.log(`==========================================\n`);
        });

        // Configurações de estabilidade
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

        // Tratamento de erro de porta ocupada
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Erro: A porta ${PORT} está sendo usada por outro processo.`);
                console.error(`💡 Tente rodar: taskkill /F /IM node.exe /T ou mude a porta no código.`);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('❌ ERRO AO INICIAR SERVIDOR:', error);
        process.exit(1);
    }
}

startServer();