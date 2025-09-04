import OrdemServico from './ordemServico-model.js';
import OrdemItem from './ordemItem-model.js';
import Produto from './produto-model.js';
import ProdutoTamanho from './produtoTamanho-model.js';
import Financeiro from './financeiro-model.js';
import Confeccao from './confeccao-model.js';

// --- Associações OrdemServico e OrdemItem ---
OrdemServico.hasMany(OrdemItem, { foreignKey: 'ordemId', as: 'itens' });
OrdemItem.belongsTo(OrdemServico, { foreignKey: 'ordemId', as: 'ordem' });

// --- Associações Produto e ProdutoTamanho ---
Produto.hasMany(ProdutoTamanho, { foreignKey: 'produtoId', as: 'tamanhosProduto' });
ProdutoTamanho.belongsTo(Produto, { foreignKey: 'produtoId', as: 'produtoPai' }); // alias único

// --- Associações OrdemServico e Confeccao ---
OrdemServico.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });
Confeccao.hasMany(OrdemServico, { foreignKey: 'confeccaoId', as: 'ordens' });

// --- Associações Financeiro ---
Financeiro.belongsTo(OrdemServico, { foreignKey: 'ordemId', as: 'ordemFinanceiro' });
Financeiro.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccaoFinanceiro' });

// --- Exportações ---
export {
  OrdemServico,
  OrdemItem,
  Produto,
  ProdutoTamanho,
  Financeiro,
  Confeccao
};
