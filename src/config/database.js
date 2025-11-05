import { Sequelize } from "sequelize";

const sequelize = new Sequelize("backendkell", "postgres", "jacob123", {
  host: "localhost",
  dialect: "postgres",
  logging: false,
  timezone: "-03:00", // <- força o Sequelize a usar horário de Brasília (UTC-3)
  dialectOptions: {
    useUTC: false, // <- desativa o uso de UTC no PostgreSQL
  }
});

export default sequelize;
