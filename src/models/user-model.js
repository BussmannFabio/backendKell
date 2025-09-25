import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define("User", {
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  senhaHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "usuarios",
  timestamps: true
});

export { User };