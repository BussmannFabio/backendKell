import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Financeiro = sequelize.define('Financeiro', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ordemId: { type: DataTypes.INTEGER, allowNull: false },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false },
  valorMaoDeObra: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  diferenca: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('ABERTO', 'PAGO'), defaultValue: 'ABERTO' },
  dataLancamento: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { 
  tableName: 'financeiro',
  timestamps: false 
});

export default Financeiro;
