// src/models/carga-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Carga = sequelize.define('Carga', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  quantidadeTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'cargas',
  timestamps: false
});

const CargaItem = sequelize.define('CargaItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cargaId: { type: DataTypes.INTEGER, allowNull: false },
  produtoTamanhoId: { type: DataTypes.INTEGER, allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'carga_itens',
  timestamps: false
});

export { Carga, CargaItem };
