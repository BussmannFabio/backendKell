import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class Carga extends Model {}

Carga.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descricao: { type: DataTypes.STRING, allowNull: false },
  data: { type: DataTypes.DATE, allowNull: false }
}, {
  sequelize,
  modelName: 'Carga',
  tableName: 'cargas',
  timestamps: true
});
