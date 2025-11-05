import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Audit = sequelize.define('Audit', {
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'audits',
    timestamps: true
  });

  return Audit;
};
