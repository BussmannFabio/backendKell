import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Role = sequelize.define("Role", {
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Remova ou comente descricao se não existe na tabela
  // descricao: {
  //   type: DataTypes.STRING,
  //   allowNull: true
  // }
}, {
  tableName: "roles",
  timestamps: false
});

export default Role;
