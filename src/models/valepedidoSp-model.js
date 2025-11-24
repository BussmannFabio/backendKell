// src/models/ValePedidoSp.js (FINAL)

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
  cidadeSeparacao: { 
    type: DataTypes.ENUM('Guaratinguetá', 'São Paulo'),
    allowNull: false,
    defaultValue: 'Guaratinguetá'
  }
}, {
  tableName: 'vale_pedido_sp',
  // O Sequelize agora gerencia automaticamente createdAt e updatedAt
  timestamps: true
});

export default ValePedidoSp;