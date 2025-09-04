import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrdemServico = sequelize.define('OrdemServico', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dataInicio: { type: DataTypes.DATE, allowNull: true },
  dataRetorno: { type: DataTypes.DATE, allowNull: true },
  status: { 
    type: DataTypes.ENUM('CRIADA', 'EM_PRODUCAO', 'RETORNADA'), 
    defaultValue: 'CRIADA' 
  },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false }
}, { 
  tableName: 'ordens_servico', 
  timestamps: false 
});

export default OrdemServico;
