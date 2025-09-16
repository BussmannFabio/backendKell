// src/models/estoqueMaterial-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Material from './material-model.js';

const EstoqueMaterial = sequelize.define('EstoqueMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: Material, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'estoque_materiais',
  timestamps: false
});

export default EstoqueMaterial;
