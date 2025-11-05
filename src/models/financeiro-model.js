import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class Financeiro extends Model {}

Financeiro.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ordemId: { type: DataTypes.INTEGER, allowNull: false },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false },
  valorMaoDeObra: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  diferenca: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('ABERTO','PAGO'), defaultValue: 'ABERTO' },
  dataLancamento: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName: 'Financeiro',
  tableName: 'financeiro',
  timestamps: false
});
