// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

console.log('--- [SISTEMA] INICIANDO BACKEND KELL (MODO REDE ATIVADO) ---');

/* ===================== CONFIGURAÇÃO DE CORS ===================== */
// Configuração agressiva para garantir que o navegador não bloqueie o POST
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 204
}));

/* ===================== MIDDLEWARES DE PARSING ===================== */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ===================== LOG INTERCEPTOR (PARA DEBUG DE REDE) ===================== */
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] INCOMING: ${req.method} ${req.originalUrl} de ${req.ip}`);
    
    // Log para verificar se o banco responde rápido ou trava
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] COMPLETED: ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

/* ===================== ROTAS PÚBLICAS ===================== */
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        serverIp: '192.168.10.15'
    });
});

app.get('/', (req, res) => {
    res.send('🚀 API Kell Online e visível na rede!');
});

/* ===================== IMPORTAÇÃO DE MODELOS E BANCO ===================== */
import './models/index.js';
import sequelize from './config/database.js';

/* ===================== IMPORTAÇÃO DE ROTAS ===================== */
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

// Definição das Rotas
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

/* ===================== TRATAMENTO 404 ===================== */
app.use((req, res) => {
    console.warn(`[404] Rota inexistente: ${req.originalUrl}`);
    res.status(404).json({ error: 'Rota não encontrada no backend' });
});

/* ===================== INICIALIZAÇÃO DO SERVIDOR ===================== */
async function startServer() {
    try {
        // Testa a conexão com o banco antes de abrir a porta
        await sequelize.authenticate();
        console.log('✅ Banco de Dados conectado via Sequelize.');
        
        // Importante: Escutando especificamente em 0.0.0.0
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n==========================================`);
            console.log(`🚀 SERVIDOR ONLINE`);
            console.log(`🏠 LOCAL: http://localhost:${PORT}`);
            console.log(`🌐 REDE:  http://192.168.10.15:${PORT}`);
            console.log(`==========================================\n`);
        });

        // Tratamento para evitar que o servidor "pendure" conexões
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

    } catch (error) {
        console.error('❌ ERRO CRÍTICO NA INICIALIZAÇÃO:', error);
        process.exit(1);
    }
}

startServer();