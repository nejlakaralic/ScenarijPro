const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../db");

const Scenario = require("./Scenario")(sequelize, DataTypes);
const Line = require("./Line")(sequelize, DataTypes);
const Delta = require("./Delta")(sequelize, DataTypes);
const Checkpoint = require("./Checkpoint")(sequelize, DataTypes);

// =====================
// RELATIONS
// =====================

// Scenario → Lines
Scenario.hasMany(Line, { foreignKey: "scenarioId", onDelete: "CASCADE" });
Line.belongsTo(Scenario, { foreignKey: "scenarioId" });

// Scenario → Deltas
Scenario.hasMany(Delta, { foreignKey: "scenarioId", onDelete: "CASCADE" });
Delta.belongsTo(Scenario, { foreignKey: "scenarioId" });

// Scenario → Checkpoints
Scenario.hasMany(Checkpoint, { foreignKey: "scenarioId", onDelete: "CASCADE" });
Checkpoint.belongsTo(Scenario, { foreignKey: "scenarioId" });

module.exports = {
  sequelize,
  Scenario,
  Line,
  Delta,
  Checkpoint
};
