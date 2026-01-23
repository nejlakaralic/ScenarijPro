const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  "wt26",
  "root",
  "password",
  {
    host: "localhost",
    port: 3306,
    dialect: "mysql",
    logging: false
  }
);

module.exports = sequelize;
