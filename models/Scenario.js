module.exports = (sequelize, DataTypes) => {
  const Scenario = sequelize.define("Scenario", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  return Scenario;
};
