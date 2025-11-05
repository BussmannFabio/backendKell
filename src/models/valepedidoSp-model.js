import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ValePedidoSp = sequelize.define('ValePedidoSp', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente: { type: DataTypes.STRING(150), allowNull: false },
  endereco: { type: DataTypes.STRING(255), allowNull: false },
  vendedor: { type: DataTypes.STRING(150), allowNull: true },
  precoTotal: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0.00 },
  precoUnitario: { type: DataTypes.DECIMAL(12,2), allowNull: true },
  volumes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  parcelas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  dataInicialPagamento: { type: DataTypes.DATEONLY, allowNull: false },
}, {
  tableName: 'vale_pedido_sp',
  timestamps: false
});

export default ValePedidoSp;
