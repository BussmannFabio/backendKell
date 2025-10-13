// src/models/index.js
import sequelize from '../config/database.js';

// Models principais
import OrdemServico from './ordemServico-model.js';
import OrdemItem from './ordemItem-model.js';
import Produto from './produto-model.js';
import ProdutoTamanho from './produtoTamanho-model.js';
import EstoqueProduto from './estoqueProduto-model.js';
import Material from './material-model.js';
import EstoqueMaterial from './estoqueMaterial-model.js';
import Financeiro from './financeiro-model.js';
import Confeccao from './confeccao-model.js';
import { User } from './user-model.js';
import Role from './role-model.js';
import { Audit } from './audit-model.js';
import ValeMaterial from './vale-material-model.js';
import MovimentacaoMaterial from './movimentacaoMaterial-model.js';
import { Carga, CargaItem } from './carga-model.js';

// ----------------------
// OrdemServico x OrdemItem
// ----------------------
OrdemServico.hasMany(OrdemItem, { foreignKey: 'ordemId', as: 'itens' });
OrdemItem.belongsTo(OrdemServico, { foreignKey: 'ordemId', as: 'ordem' });

// ----------------------
// Produto x ProdutoTamanho
// ----------------------
Produto.hasMany(ProdutoTamanho, { foreignKey: 'produtoId', as: 'tamanhosProduto' });
ProdutoTamanho.belongsTo(Produto, { foreignKey: 'produtoId', as: 'produtoPai' });

// ----------------------
// ProdutoTamanho x EstoqueProduto
// ----------------------
ProdutoTamanho.hasOne(EstoqueProduto, { foreignKey: 'produtoTamanhoId', as: 'estoqueProduto' });
EstoqueProduto.belongsTo(ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanhoPai' });

// ----------------------
// Material x EstoqueMaterial
// ----------------------
Material.hasOne(EstoqueMaterial, { foreignKey: 'materialId', as: 'estoque' });
EstoqueMaterial.belongsTo(Material, { foreignKey: 'materialId', as: 'materialPai' });

// ----------------------
// ValeMaterial x User
// ----------------------
ValeMaterial.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
User.hasMany(ValeMaterial, { foreignKey: 'usuarioId', as: 'valesCriados' });

// ----------------------
// MovimentacaoMaterial x Material / Confeccao / User / ValeMaterial
// ----------------------
MovimentacaoMaterial.belongsTo(Material, { foreignKey: 'materialId', as: 'materialPai' });
Material.hasMany(MovimentacaoMaterial, { foreignKey: 'materialId', as: 'movimentacoes' });

MovimentacaoMaterial.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });
Confeccao.hasMany(MovimentacaoMaterial, { foreignKey: 'confeccaoId', as: 'movimentacoes' });

MovimentacaoMaterial.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
User.hasMany(MovimentacaoMaterial, { foreignKey: 'usuarioId', as: 'movimentacoesUsuario' });

MovimentacaoMaterial.belongsTo(ValeMaterial, { foreignKey: 'valeMaterialId', as: 'vale' });
ValeMaterial.hasMany(MovimentacaoMaterial, { foreignKey: 'valeMaterialId', as: 'movimentacoes' });

// ----------------------
// OrdemServico x Confeccao
// ----------------------
OrdemServico.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });
Confeccao.hasMany(OrdemServico, { foreignKey: 'confeccaoId', as: 'ordens' });

// ----------------------
// Financeiro x OrdemServico / Confeccao
// ----------------------
Financeiro.belongsTo(OrdemServico, { foreignKey: 'ordemId', as: 'ordemFinanceiro' });
Financeiro.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccaoFinanceiro' });

// ----------------------
// User x Role
// ----------------------
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId', as: 'usuarios' });

// ----------------------
// Audit x User
// ----------------------
Audit.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
User.hasMany(Audit, { foreignKey: 'usuarioId', as: 'auditorias' });

// ----------------------
// Material x ValeMaterial (opcional via tabela de itens)
// ----------------------
Material.belongsToMany(ValeMaterial, { through: 'vale_material_itens', foreignKey: 'materialId', as: 'vales' });
ValeMaterial.belongsToMany(Material, { through: 'vale_material_itens', foreignKey: 'valeId', as: 'materiais' });

// ----------------------
// Carga x CargaItem
// ----------------------
Carga.hasMany(CargaItem, { foreignKey: 'cargaId', as: 'itens' });
CargaItem.belongsTo(Carga, { foreignKey: 'cargaId', as: 'carga' });

// ----------------------
// CargaItem x ProdutoTamanho
// ----------------------
CargaItem.belongsTo(ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });
ProdutoTamanho.hasMany(CargaItem, { foreignKey: 'produtoTamanhoId', as: 'cargaItens' });

// ----------------------
// Exportações
// ----------------------
export {
  sequelize,
  OrdemServico,
  OrdemItem,
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  Material,
  EstoqueMaterial,
  Financeiro,
  Confeccao,
  User,
  Role,
  Audit,
  ValeMaterial,
  MovimentacaoMaterial,
  Carga,
  CargaItem
};
