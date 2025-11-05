import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class EstoqueMaterial extends Model {}

EstoqueMaterial.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }
}, {
  sequelize,
  modelName: 'EstoqueMaterial',
  tableName: 'estoque_materiais',
  timestamps: false
});
