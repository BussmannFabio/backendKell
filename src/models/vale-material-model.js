// src/models/vale-material-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Material from './material-model.js';

const ValeMaterial = sequelize.define('ValeMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'vale_material', timestamps: false });

ValeMaterial.belongsToMany(Material, { through: 'vale_material_itens', foreignKey: 'valeId', as: 'materiais' });
Material.belongsToMany(ValeMaterial, { through: 'vale_material_itens', foreignKey: 'materialId', as: 'vales' });

export default ValeMaterial;
