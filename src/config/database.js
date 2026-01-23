import { Sequelize } from "sequelize";

const sequelize = new Sequelize("backendkell", "postgres", "jacob123", {
  host: "localhost",
  dialect: "postgres",
  logging: false, // Mantenha false para limpar o console, ou true para ver o erro SQL real
  quoteIdentifiers: true, // ESTA LINHA É ESSENCIAL PARA POSTGRES COM CAMELCASE
  timezone: "-03:00", 
  dialectOptions: {
    useUTC: false,
  }
});

export default sequelize;