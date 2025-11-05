import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './user-model.js'; // ✅ import corrigido

const ValeMaterial = sequelize.define('ValeMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data: { type: DataTypes.DATE, allowNull: false },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  observacao: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'vale_material',
  timestamps: true
});

export default ValeMaterial;
