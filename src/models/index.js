// src/models/index.js
import sequelize from '../config/database.js';

import Produto from './produto-model.js';
import ProdutoTamanho from './produtoTamanho-model.js';
import EstoqueProduto from './estoqueProduto-model.js';
import EstoqueSp from './estoqueSp-model.js';
import Carga from './carga-model.js';
import CargaItem from './cargaItem-model.js';
import OrdemServico from './ordemServico-model.js';
import OrdemItem from './ordemItem-model.js';
import Confeccao from './confeccao-model.js';
import Financeiro from './financeiro-model.js';
import ValePedidoSp from './valePedidoSp-model.js';
import ValePedidoItemSp from './valePedidoItemSp-model.js';
import MovimentacaoMaterial from './movimentacaoMaterial-model.js';
import Role from './role-model.js';
import User from './user-model.js';
import ValeMaterial from './valeMaterial-model.js';
import Material from './material-model.js';
import EstoqueMaterial from './estoqueMaterial-model.js';

console.log('=== INICIANDO ASSOCIAÇÕES ===');

function safe(source, fn, target, options = {}) {
  const as = options.as;
  if (as && source.associations && source.associations[as]) {
    return;
  }
  source[fn](target, options);
}

/* PRODUTOS */
safe(Produto, 'hasMany', ProdutoTamanho, { foreignKey: 'produtoId', as: 'tamanhos' });
safe(ProdutoTamanho, 'belongsTo', Produto, { foreignKey: 'produtoId', as: 'produto' });

safe(ProdutoTamanho, 'hasOne', EstoqueProduto, { foreignKey: 'produtoTamanhoId', as: 'estoqueProduto' });
safe(EstoqueProduto, 'belongsTo', ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

safe(ProdutoTamanho, 'hasMany', EstoqueSp, { foreignKey: 'produtoTamanhoId', as: 'estoquesSp' });
safe(EstoqueSp, 'belongsTo', ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

/* CARGAS */
safe(Carga, 'hasMany', CargaItem, { foreignKey: 'cargaId', as: 'itensCarga' });
safe(CargaItem, 'belongsTo', Carga, { foreignKey: 'cargaId', as: 'carga' });

safe(ProdutoTamanho, 'hasMany', CargaItem, { foreignKey: 'produtoTamanhoId', as: 'cargaItens' });
safe(CargaItem, 'belongsTo', ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

/* ORDEM */
safe(Carga, 'hasMany', OrdemServico, { foreignKey: 'cargaId', as: 'ordensCarga' });
safe(OrdemServico, 'belongsTo', Carga, { foreignKey: 'cargaId', as: 'carga' });

safe(OrdemServico, 'hasMany', OrdemItem, { foreignKey: 'ordemServicoId', as: 'itens' });
safe(OrdemItem, 'belongsTo', OrdemServico, { foreignKey: 'ordemServicoId', as: 'ordemServico' });

safe(ProdutoTamanho, 'hasMany', OrdemItem, { foreignKey: 'produtoTamanhoId', as: 'ordemItens' });
safe(OrdemItem, 'belongsTo', ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

safe(Confeccao, 'hasMany', OrdemServico, { foreignKey: 'confeccaoId', as: 'ordensConfeccao' });
safe(OrdemServico, 'belongsTo', Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });

/* VALES */
safe(ValePedidoSp, 'hasMany', ValePedidoItemSp, { foreignKey: 'valePedidoSpId', as: 'itensValePedidoSp' });
safe(ValePedidoItemSp, 'belongsTo', ValePedidoSp, { foreignKey: 'valePedidoSpId', as: 'valePedidoSp' });

safe(ProdutoTamanho, 'hasMany', ValePedidoItemSp, { foreignKey: 'produtoTamanhoId', as: 'valesItensSp' });
safe(ValePedidoItemSp, 'belongsTo', ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

/* USERS / ROLES */
safe(User, 'belongsTo', Role, { foreignKey: 'roleId', as: 'role' });
safe(Role, 'hasMany', User, { foreignKey: 'roleId', as: 'usuarios' });

safe(User, 'hasMany', ValeMaterial, { foreignKey: 'usuarioId', as: 'valesMaterial' });
safe(ValeMaterial, 'belongsTo', User, { foreignKey: 'usuarioId', as: 'usuario' });

/* MATERIAIS */
safe(Material, 'hasOne', EstoqueMaterial, { foreignKey: 'materialId', as: 'estoqueMaterial' });
safe(EstoqueMaterial, 'belongsTo', Material, { foreignKey: 'materialId', as: 'materialPai' });

safe(Material, 'hasMany', MovimentacaoMaterial, { foreignKey: 'materialId', as: 'movimentacoesMaterial' });
safe(MovimentacaoMaterial, 'belongsTo', Material, { foreignKey: 'materialId', as: 'material' });

safe(Confeccao, 'hasMany', MovimentacaoMaterial, { foreignKey: 'confeccaoId', as: 'movimentacoesConfeccao' });
safe(MovimentacaoMaterial, 'belongsTo', Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });

safe(User, 'hasMany', MovimentacaoMaterial, { foreignKey: 'usuarioId', as: 'movimentacoesUsuario' });
safe(MovimentacaoMaterial, 'belongsTo', User, { foreignKey: 'usuarioId', as: 'usuario' });

/* VALE MATERIAL (M:N) */
safe(Material, 'belongsToMany', ValeMaterial, {
  through: 'vale_material_itens',
  foreignKey: 'materialId',
  otherKey: 'valeMaterialId',
  as: 'valesAssociados'
});
safe(ValeMaterial, 'belongsToMany', Material, {
  through: 'vale_material_itens',
  foreignKey: 'valeMaterialId',
  otherKey: 'materialId',
  as: 'materiaisVale'
});

/* FINANCEIRO */
safe(Financeiro, 'belongsTo', OrdemServico, { foreignKey: 'ordemId', as: 'ordemFinanceiro' });
safe(Financeiro, 'belongsTo', Confeccao, { foreignKey: 'confeccaoId', as: 'confeccaoFinanceiro' });

console.log('=== ASSOCIAÇÕES FINALIZADAS ===');

try {
  console.log('Associação tamanhos existe:', !!(Produto && Produto.associations && Produto.associations.tamanhos));
  console.log('Aliases em Produto:', Produto && Produto.associations ? Object.keys(Produto.associations) : []);
} catch (err) {
  console.error('Erro ao inspecionar associações do Produto:', err && err.message);
}

export {
  sequelize,
  Produto,
  ProdutoTamanho,
  EstoqueProduto,
  EstoqueSp,
  Carga,
  CargaItem,
  OrdemServico,
  OrdemItem,
  Confeccao,
  Financeiro,
  ValePedidoSp,
  ValePedidoItemSp,
  MovimentacaoMaterial,
  Role,
  User,
  ValeMaterial,
  Material,
  EstoqueMaterial
};
