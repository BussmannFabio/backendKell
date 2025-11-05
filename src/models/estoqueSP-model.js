import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class EstoqueSp extends Model {}

EstoqueSp.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  sequelize,
  modelName: 'EstoqueSp',
  tableName: 'estoques_sp',
  timestamps: false
});
