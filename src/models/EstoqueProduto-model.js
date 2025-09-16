// src/models/estoqueProduto-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import ProdutoTamanho from './produtoTamanho-model.js';

const EstoqueProduto = sequelize.define('EstoqueProduto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false }, // vínculo com ProdutoTamanho
  quantidadeAberta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // peças em produção
  quantidadePronta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }  // peças finalizadas
}, {
  tableName: 'estoque_produtos',
  timestamps: false
});

export default EstoqueProduto;
