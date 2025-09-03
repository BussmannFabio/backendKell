import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProdutoTamanho = sequelize.define('ProdutoTamanho', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  produtoId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tamanho: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  estoqueMinimo: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'produto_tamanhos',
  timestamps: false
});

export default ProdutoTamanho;
