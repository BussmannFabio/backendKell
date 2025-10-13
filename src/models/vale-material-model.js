// src/models/vale-material-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ValeMaterial = sequelize.define('ValeMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data: { type: DataTypes.DATE, allowNull: false },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false }, // aponta por id; associações no index.js
  observacao: { type: DataTypes.TEXT, allowNull: true } // opcional
}, {
  tableName: 'vale_material',
  timestamps: true
});

export default ValeMaterial;
