import os from 'os';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Importação do banco e modelos (Assegure que as associações ocorrem aqui)
import './models/index.js'; 
import sequelize from './config/database.js';

// Importação das rotas
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
const PORT = Number(process.env.PORT) || 3001; 

/* ===================== MIDDLEWARES ===================== */
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log simplificado para não poluir o terminal
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    next();
});

/* ===================== DEFINIÇÃO DAS ROTAS ===================== */
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

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

/* ===================== INICIALIZAÇÃO RESILIENTE ===================== */
async function startServer() {
    try {
        console.log('--- [SISTEMA] CONECTANDO AO BANCO DE DADOS... ---');
        await sequelize.authenticate();
        console.log('✅ Banco de Dados conectado com sucesso.');

        // Criamos a instância do servidor
        const server = app.listen(PORT, '0.0.0.0', () => {
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

        // Configurações de estabilidade de socket
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

        // Tratamento de erros do servidor (Porta ocupada, etc)
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ ERRO FATAL: A porta ${PORT} está sendo usada.`);
                console.error(`💡 Resolva com: taskkill /F /IM node.exe /T\n`);
                // Não damos process.exit(1) aqui para permitir que o nodemon tente reiniciar
                // se o processo antigo for encerrado externamente.
                server.close();
            } else {
                console.error('❌ Erro no Servidor:', err);
            }
        });

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NA INICIALIZAÇÃO:', error.message);
        // Aguarda 5 segundos e tenta fechar para o Nodemon reiniciar
        setTimeout(() => process.exit(1), 5000);
    }
}

// Inicia o processo
startServer();