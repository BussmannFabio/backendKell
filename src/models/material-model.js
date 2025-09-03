// src/models/material-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  unidadeMedida: { type: DataTypes.STRING(20), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  estoqueMinimo: { type: DataTypes.DECIMAL(10,2), allowNull: false }
}, { tableName: 'materiais', timestamps: false });

export default Material;
