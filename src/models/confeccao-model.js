import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class Confeccao extends Model {}

Confeccao.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false }
}, {
  sequelize,
  modelName: 'Confeccao',
  tableName: 'confeccoes',
  timestamps: false
});
