import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const OrdemServico = sequelize.define('OrdemServico', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dataInicio: { type: DataTypes.DATEONLY, allowNull: true, field: 'dataInicio' },
  dataRetorno: { type: DataTypes.DATEONLY, allowNull: true, field: 'dataRetorno' },
  
  status: {
    // Adicionado 'EM_PRODUCAO' e 'ABERTA' para compatibilidade com o frontend
    type: DataTypes.ENUM('CRIADA', 'ABERTA', 'EM_PRODUCAO', 'RETORNADA'),
    defaultValue: 'CRIADA'
  },
  
  confeccaoId: { type: DataTypes.INTEGER, allowNull: false, field: 'confeccaoId' },

  // Alterado para FLOAT para evitar erro 500 em cálculos decimais no retorno de OS
  totalPecasEsperadas: { 
    type: DataTypes.FLOAT, 
    allowNull: true, 
    field: 'totalPecasEsperadas' 
  },
  totalPecasEsperadasAjustadas: { 
    type: DataTypes.FLOAT, 
    allowNull: true, 
    field: 'totalPecasEsperadasAjustadas' 
  },
  totalPecasReais: { 
    type: DataTypes.FLOAT, 
    allowNull: true, 
    field: 'totalPecasReais' 
  },
  diferencaPecas: { 
    type: DataTypes.FLOAT, 
    allowNull: true, 
    field: 'diferencaPecas' 
  },
  diferencaPercentual: { 
    type: DataTypes.FLOAT, 
    allowNull: true, 
    field: 'diferencaPercentual' 
  }
}, {
  sequelize,
  modelName: 'OrdemServico',
  tableName: 'ordens_servico',
  // Mantido false conforme seu banco atual, mas isso exige atenção na ordenação
  timestamps: false 
});

export default OrdemServico;