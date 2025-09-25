// src/models/audit-model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const Audit = sequelize.define('Audit', {
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.JSONB, allowNull: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'audits',
  timestamps: true
});
