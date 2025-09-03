import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import OrdemItem from './ordemItem-model.js';
import Confeccao from './confeccao-model.js';

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

// Relação com OrdemItem
OrdemServico.hasMany(OrdemItem, { foreignKey: 'ordemId', as: 'itens' });
OrdemItem.belongsTo(OrdemServico, { foreignKey: 'ordemId', as: 'ordem' });

// Relação com Confeccao
Confeccao.hasMany(OrdemServico, { foreignKey: 'confeccaoId', as: 'ordens' });
OrdemServico.belongsTo(Confeccao, { foreignKey: 'confeccaoId', as: 'confeccao' });

export default OrdemServico;
