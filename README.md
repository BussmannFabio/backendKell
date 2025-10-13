BackEndKell – API Node.js + Express + PostgreSQL

📋 Visão Geral

O BackEndKell é uma API REST desenvolvida em Node.js com Express e Sequelize, utilizada como camada de backend do Kellynha App.
Ela gerencia cadastros, movimentações de estoque, controle financeiro e autenticação de usuários, integrando-se ao frontend Angular.

🗂️ Estrutura de Pastas
BackEndKell/
│
├── node_modules/
├── scripts/
├── src/
│   ├── config/          # Configuração do banco de dados (PostgreSQL)
│   ├── controllers/     # Lógica de negócio de cada módulo
│   ├── middlewares/     # Autenticação e validação
│   ├── models/          # Modelos Sequelize das tabelas
│   ├── routes/          # Definição de rotas Express
│   │
│   ├── server.js        # Ponto principal da aplicação (API)
│   ├── reset.js         # Script auxiliar para reset de dados
│   ├── sync-material.js # Sincronização específica de materiais
│   └── sync.js          # Sincronização geral do banco
│
├── start-server.bat     # Script para iniciar o servidor via NSSM (Windows)
├── package.json
└── .gitignore

⚙️ Dependências Principais
Pacote	Função
express	Framework HTTP principal
sequelize	ORM para comunicação com PostgreSQL
pg / pg-hstore	Drivers do PostgreSQL
bcrypt	Criptografia de senhas
jsonwebtoken	Autenticação JWT
cors	Permitir requisições do frontend Angular
axios	Requisições HTTP internas (quando necessário)
💾 Banco de Dados

Utiliza PostgreSQL.

Configuração padrão em src/config/database.js:

const sequelize = new Sequelize("backendkell", "postgres", "jacob123", {
  host: "localhost",
  dialect: "postgres",
  logging: false
});


O banco é sincronizado automaticamente com:

sequelize.sync({ alter: true })


Para sincronização manual, use:

node src/sync.js


Certifique-se de que o serviço PostgreSQL esteja ativo antes de iniciar o servidor.

🚀 Instalação e Execução

Instalar dependências:

npm install


Iniciar servidor:

node src/server.js


ou em modo dev via npm script:

npm run dev

🔹 Execução automática no Windows (opcional)

É possível usar NSSM para iniciar a API automaticamente ao ligar o computador.

Basta apontar o NSSM para o arquivo start-server.bat.

🌐 Configuração de Rede

API configurada para aceitar conexões de dispositivos na mesma rede local:

app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://192.168.10.19:4200',
    /\.192\.168\.10\.\d{1,3}$/
  ]
}));


Backend: http://192.168.10.19:3000

Frontend: http://192.168.10.19:4200

Certifique-se de liberar a porta 3000 no firewall do Windows.

🧩 Rotas Principais
Rota	Função	Proteção
/auth/login	Login de usuário	Pública
/auth/register	Registro de novo usuário	Pública
/users	Gerenciamento de usuários	Admin
/confeccoes	Cadastro de confecções	Admin
/produtos	Cadastro e controle de produtos	Admin
/materiais	Cadastro e controle de materiais	Admin
/ordens	Criação e retorno de ordens de serviço	Admin/User
/movimentar-estoque	Controle de movimentação de estoque	Admin/User
/financeiro	Controle financeiro geral	Admin
/estoque	Consulta de estoque atual	Admin/User

Cada requisição gera logs no console para monitoramento e rastreio de erros.

🧱 Boas práticas

Evite usar force: true no sequelize.sync() (apaga dados).

Use alter: true apenas em ambiente controlado.

Faça backups regulares do PostgreSQL:

pg_dump backendkell > backup.sql


Atualize dependências regularmente:

npm update

📄 Licença

Este projeto é de uso interno da Kellynha Ltda, desenvolvido para controle de produção, estoque e financeiro.