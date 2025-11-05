import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class Material extends Model {}

Material.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  unidadeMedida: { type: DataTypes.STRING(20), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  estoqueMinimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  criadoPor: { type: DataTypes.STRING(100), allowNull: true },
  atualizadoPor: { type: DataTypes.STRING(100), allowNull: true },
  deletadoPor: { type: DataTypes.STRING(100), allowNull: true }
}, {
  sequelize,
  modelName: 'Material',
  tableName: 'materiais',
  timestamps: true
});
