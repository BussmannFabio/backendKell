import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Confeccao = sequelize.define('Confeccao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false }
}, {
  tableName: 'confeccoes',
  timestamps: false
});

export default Confeccao;
