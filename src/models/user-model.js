// src/models/user-model.js
import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export default class User extends Model {
  toJSON() {
    const values = Object.assign({}, this.get());
    // não retornar senha hash em JSON por segurança
    delete values.senhaHash;
    return values;
  }
}

User.init({
  nome: { type: DataTypes.STRING(150), allowNull: false },
  senhaHash: { type: DataTypes.STRING(255), allowNull: false },
  roleId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  sequelize,
  modelName: 'User',
  tableName: 'usuarios',
  timestamps: true, // você tinha timestamps: true no original
  underscored: false
});
