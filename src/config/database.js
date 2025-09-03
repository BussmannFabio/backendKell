import { Sequelize } from "sequelize";

const sequelize = new Sequelize("backendkell", "postgres", "jacob123", {
  host: "localhost",
  dialect: "postgres",
  logging: false
});

export default sequelize;
