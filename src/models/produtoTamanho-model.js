// src/models/produtoTamanho-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProdutoTamanho = sequelize.define('ProdutoTamanho', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produtoId: { type: DataTypes.INTEGER, allowNull: false },
  tamanho: { type: DataTypes.STRING(10), allowNull: false },
  estoqueMinimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'produto_tamanhos',
  timestamps: false,
  modelName: 'ProdutoTamanho'
});

export default ProdutoTamanho;
