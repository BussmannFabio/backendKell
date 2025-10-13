// src/models/estoqueMaterial-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EstoqueMaterial = sequelize.define('EstoqueMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false }, // FK por id; associação no index.js
  quantidade: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }
}, {
  tableName: 'estoque_materiais',
  timestamps: false
});

export default EstoqueMaterial;
