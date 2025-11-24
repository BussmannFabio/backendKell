// src/models/ValePedidoItemSp.js (FINAL)

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ValePedidoItemSp = sequelize.define('ValePedidoItemSp', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  valePedidoSpId: { type: DataTypes.INTEGER, allowNull: false },

  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false },

  quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  precoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },

  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 }
}, {
  tableName: 'vale_pedido_item_sp',
  // O Sequelize agora gerencia automaticamente createdAt e updatedAt
  timestamps: true
});

export default ValePedidoItemSp;