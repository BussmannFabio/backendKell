import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import ProdutoTamanho from './produtoTamanho-model.js';

const Produto = sequelize.define('Produto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  codigo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  valorMaoDeObraDuzia: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  valorMaoDeObraPeca: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  }
}, {
  tableName: 'produtos',
  timestamps: false
});

// Associação 1:N com ProdutoTamanho
Produto.hasMany(ProdutoTamanho, { foreignKey: 'produtoId', as: 'tamanhos' });
ProdutoTamanho.belongsTo(Produto, { foreignKey: 'produtoId', as: 'produto' });

export default Produto;
