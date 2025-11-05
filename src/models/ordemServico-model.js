import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class OrdemServico extends Model {}

OrdemServico.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dataInicio: { type: DataTypes.DATEONLY, allowNull: true },
  dataRetorno: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('CRIADA', 'EM_PRODUCAO', 'RETORNADA'), defaultValue: 'CRIADA' },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  sequelize,
  modelName: 'OrdemServico',
  tableName: 'ordens_servico',
  timestamps: false
});
