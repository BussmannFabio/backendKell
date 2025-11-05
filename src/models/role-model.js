// src/models/role-model.js
import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class Role extends Model {}

Role.init({
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, {
  sequelize,
  modelName: 'Role',
  tableName: 'roles',
  timestamps: false,
  underscored: false
});
