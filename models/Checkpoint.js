module.exports = (sequelize, DataTypes) => {
  const Checkpoint = sequelize.define("Checkpoint", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    scenarioId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    timestamp: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  });

  return Checkpoint;
};
