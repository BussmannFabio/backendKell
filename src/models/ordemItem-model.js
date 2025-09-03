import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrdemItem = sequelize.define('OrdemItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ordemId: { type: DataTypes.INTEGER, allowNull: false },
  produtoId: { type: DataTypes.INTEGER, allowNull: false },
  tamanho: { type: DataTypes.STRING(10), allowNull: false },
  volumes: { type: DataTypes.INTEGER, allowNull: false },
  pecasPorVolume: { type: DataTypes.INTEGER, allowNull: false },
  pecasEsperadas: { type: DataTypes.INTEGER, allowNull: false },
  pecasReais: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'ordem_itens',
  timestamps: false
});

export default OrdemItem;
