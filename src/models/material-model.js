// src/models/material-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  unidadeMedida: { type: DataTypes.STRING(20), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  criadoPor: { type: DataTypes.STRING(100), allowNull: true },
  atualizadoPor: { type: DataTypes.STRING(100), allowNull: true },
  deletadoPor: { type: DataTypes.STRING(100), allowNull: true }
}, {
  tableName: 'materiais',
  timestamps: true
});

export default Material;
