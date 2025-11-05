import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MovimentacaoMaterial = sequelize.define('MovimentacaoMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM('entrada', 'saida'), allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false },
  valorUnitario: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  confeccaoId: { type: DataTypes.INTEGER, allowNull: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true },
  referenciaFinanceiraId: { type: DataTypes.INTEGER, allowNull: true },
  emAberto: { type: DataTypes.BOOLEAN, defaultValue: true },
  observacao: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'movimentacoes_materiais',
  timestamps: true
});

export default MovimentacaoMaterial;
