module.exports = (sequelize, DataTypes) => {
  const Line = sequelize.define("Line", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    lineId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    nextLineId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    scenarioId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  });

  return Line;
};
