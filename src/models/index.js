// src/models/index.js
import OrdemServico from './ordemServico-model.js';
import OrdemItem from './ordemItem-model.js';
import Produto from './produto-model.js';
import ProdutoTamanho from './produtoTamanho-model.js';
import EstoqueProduto from './EstoqueProduto-model.js';
import Material from './material-model.js';
import EstoqueMaterial from './EstoqueMaterial-model.js';
import Financeiro from './financeiro-model.js';
import Confeccao from './confeccao-model.js';
import sequelize from '../config/database.js';

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
Material.hasOne(EstoqueMaterial, { foreignKey: 'materialId', as: 'estoqueMaterial' });
EstoqueMaterial.belongsTo(Material, { foreignKey: 'materialId', as: 'materialPai' });

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
// Exportações
// ----------------------
export {
  OrdemServico,
  OrdemItem,
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  Material,
  EstoqueMaterial,
  Financeiro,
  sequelize,
  Confeccao
};
