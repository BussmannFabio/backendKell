import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class CargaItem extends Model {}

CargaItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quantidade: { type: DataTypes.INTEGER, allowNull: false },
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false },
  cargaId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  sequelize,
  modelName: 'CargaItem',
  tableName: 'carga_itens',
  timestamps: true
});
