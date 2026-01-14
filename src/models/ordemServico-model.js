import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrdemServico = sequelize.define('OrdemServico', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dataInicio: { type: DataTypes.DATEONLY, allowNull: true },
  dataRetorno: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('CRIADA', 'EM_PRODUCAO', 'RETORNADA'),
    defaultValue: 'CRIADA'
  },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false },

  // Novos campos para o resumo de fechamento
  totalPecasEsperadas: { type: DataTypes.INTEGER, allowNull: true },
  totalPecasEsperadasAjustadas: { type: DataTypes.INTEGER, allowNull: true },
  totalPecasReais: { type: DataTypes.INTEGER, allowNull: true },
  diferencaPecas: { type: DataTypes.INTEGER, allowNull: true },
  diferencaPercentual: { type: DataTypes.FLOAT, allowNull: true }
}, {
  sequelize,
  modelName: 'OrdemServico',
  tableName: 'ordens_servico',
  timestamps: false
});

// ESSA LINHA É A QUE RESOLVE O ERRO DE NODEMON
export default OrdemServico;