import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ValePedidoSp = sequelize.define('ValePedidoSp', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente: { type: DataTypes.STRING(150), allowNull: false },
  endereco: { type: DataTypes.STRING(255), allowNull: false },
  vendedor: { type: DataTypes.STRING(150), allowNull: true },
  
  // O status é a chave do novo fluxo
  status: { 
    type: DataTypes.ENUM('ROMANEIO', 'FINALIZADO', 'CANCELADO'), 
    allowNull: false, 
    defaultValue: 'ROMANEIO' 
  },

  precoTotal: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0.00 },
  volumes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  parcelas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  dataInicialPagamento: { type: DataTypes.DATEONLY, allowNull: false },
  
  // Data em que o separador confirmou a saída
  dataFinalizacao: { type: DataTypes.DATE, allowNull: true },
  
  cidadeSeparacao: { 
    type: DataTypes.ENUM('Guaratinguetá', 'São Paulo'),
    allowNull: false,
    defaultValue: 'Guaratinguetá'
  },
  
  observacao: { type: DataTypes.TEXT, allowNull: true } // Útil para recados da separação
}, {
  tableName: 'vale_pedido_sp',
  timestamps: true
});

export default ValePedidoSp;