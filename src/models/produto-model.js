// src/models/produto-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Produto = sequelize.define('Produto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  descricao: { type: DataTypes.STRING(255), allowNull: true },
  valorMaoDeObraDuzia: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  valorMaoDeObraPeca: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  precoVendaDuzia: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0.00 },
  precoVendaPeca: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0.00 }
}, {
  tableName: 'produtos',
  timestamps: false,
  modelName: 'Produto'
});

export default Produto;
