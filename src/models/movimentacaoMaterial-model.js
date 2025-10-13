// src/models/movimentacaoMaterial-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MovimentacaoMaterial = sequelize.define('MovimentacaoMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM('entrada','saida'), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  valorUnitario: { type: DataTypes.DECIMAL(10,2) }, // opcional, útil p/ financeiro
  confeccaoId: { type: DataTypes.INTEGER }, // opcional
  usuarioId: { type: DataTypes.INTEGER }, // opcional — quem realizou
  referenciaFinanceiraId: { type: DataTypes.INTEGER }, // opcional FK p/ financeiro
  emAberto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, // status financeiro
  observacao: { type: DataTypes.STRING(255) }
}, {
  tableName: 'movimentacoes_materiais',
  timestamps: true
});

export default MovimentacaoMaterial;
