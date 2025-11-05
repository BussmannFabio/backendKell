import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class EstoqueProduto extends Model {}

EstoqueProduto.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false },
  quantidadeAberta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  quantidadePronta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  sequelize,
  modelName: 'EstoqueProduto',
  tableName: 'estoque_produtos',
  timestamps: false
});
