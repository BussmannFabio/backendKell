import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import ValePedidoSp from './valePedidoSp-model.js';
import Produto from './produto-model.js';
import ProdutoTamanho from './produtoTamanho-model.js';

const ValePedidoItemSp = sequelize.define('ValePedidoItemSp', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  valePedidoSpId: { type: DataTypes.INTEGER, allowNull: false }, // FK -> ValePedidoSp
  produtoId: { type: DataTypes.INTEGER, allowNull: false },       // FK -> Produto
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: true }, // FK -> ProdutoTamanho
  volumes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  precoUnitario: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0.00 },
  precoTotal: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0.00 }
}, {
  tableName: 'vale_pedido_sp_itens',
  timestamps: false
});

// Associações
ValePedidoItemSp.belongsTo(ValePedidoSp, { foreignKey: 'valePedidoSpId', as: 'valePedidoSp' });
ValePedidoSp.hasMany(ValePedidoItemSp, { foreignKey: 'valePedidoSpId', as: 'itens' });

ValePedidoItemSp.belongsTo(Produto, { foreignKey: 'produtoId', as: 'produto' });
ValePedidoItemSp.belongsTo(ProdutoTamanho, { foreignKey: 'produtoTamanhoId', as: 'produtoTamanho' });

export default ValePedidoItemSp;
