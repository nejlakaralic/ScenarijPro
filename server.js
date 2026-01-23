const express = require("express");
const path = require("path");
const { Op } = require("sequelize");

const { Scenario, Line, Delta, Checkpoint } = require("./models");
const sequelize = require("./db");

const app = express();
app.use(express.json());

// =====================
// SERVE FRONTEND
// =====================
app.use(express.static(path.join(__dirname, "html")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/css", express.static(path.join(__dirname, "css")));

// =====================
// HELPERS
// =====================
function unixTimestampSeconds() {
  return Math.floor(Date.now() / 1000);
}

function orderLinesByLinks(lines) {
  if (!lines.length) return [];

  const map = new Map(lines.map(l => [l.lineId, l]));
  const pointed = new Set();
  lines.forEach(l => l.nextLineId != null && pointed.add(l.nextLineId));

  let head = lines.find(l => !pointed.has(l.lineId)) || lines[0];
  const ordered = [];
  const visited = new Set();

  while (head && !visited.has(head.lineId)) {
    visited.add(head.lineId);
    ordered.push(head);
    head = head.nextLineId != null ? map.get(head.nextLineId) : null;
  }

  return ordered;
}

function wrapTextIntoLines(text, maxWords = 20) {
  const words = text.trim().split(/\s+/);
  const result = [];
  for (let i = 0; i < words.length; i += maxWords) {
    result.push(words.slice(i, i + maxWords).join(" "));
  }
  return result;
}

// =====================
// LOCKING (GLOBAL, IN-MEMORY)
// =====================
const lineLocks = new Map(); // "scenarioId:lineId" -> userId
const userLocks = new Map(); // userId -> { scenarioId, lineId }

function lineKey(sid, lid) {
  return `${sid}:${lid}`;
}

// =====================
// ROUTES – SPIRALA 3
// =====================

// CREATE SCENARIO
app.post("/api/scenarios", async (req, res) => {
  const title = req.body?.title?.trim() || "Neimenovani scenarij";

  const scenario = await Scenario.create({ title });

  await Line.create({
    scenarioId: scenario.id,
    lineId: 1,
    text: "",
    nextLineId: null
  });

  res.status(200).json({
    id: scenario.id,
    title,
    content: [{ lineId: 1, text: "", nextLineId: null }]
  });
});

// GET SCENARIO
app.get("/api/scenarios/:scenarioId", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);

  const scenario = await Scenario.findByPk(scenarioId, { include: Line });
  if (!scenario)
    return res.status(404).json({ message: "Scenario ne postoji!" });

  const content = orderLinesByLinks(
    scenario.Lines.map(l => ({
      lineId: l.lineId,
      text: l.text,
      nextLineId: l.nextLineId
    }))
  );

  res.status(200).json({
    id: scenario.id,
    title: scenario.title,
    content
  });
});

// LOCK LINE
app.post("/api/scenarios/:scenarioId/lines/:lineId/lock", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const lineId = Number(req.params.lineId);
  const userId = req.body?.userId;

  const key = lineKey(scenarioId, lineId);

  if (lineLocks.has(key) && lineLocks.get(key) !== userId) {
    return res.status(409).json({ message: "Linija je vec zakljucana!" });
  }

  // global unlock previous
  const prev = userLocks.get(userId);
  if (prev) {
    lineLocks.delete(lineKey(prev.scenarioId, prev.lineId));
  }

  lineLocks.set(key, userId);
  userLocks.set(userId, { scenarioId, lineId });

  res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
});

// UPDATE LINE
app.put("/api/scenarios/:scenarioId/lines/:lineId", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const lineId = Number(req.params.lineId);
  const userId = req.body?.userId;
  const newText = req.body?.newText;

  // Validacija
  if (!Array.isArray(newText) || newText.length === 0) {
    return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
  }

  const key = lineKey(scenarioId, lineId);

  if (!lineLocks.has(key)) {
    return res.status(409).json({ message: "Linija nije zakljucana!" });
  }

  if (lineLocks.get(key) !== userId) {
    return res.status(409).json({ message: "Linija je vec zakljucana!" });
  }

  // Učitaj sve linije scenarija
  const lines = await Line.findAll({
    where: { scenarioId },
    order: [["lineId", "ASC"]]
  });

  const current = lines.find(l => l.lineId === lineId);
  if (!current) {
    return res.status(404).json({ message: "Linija ne postoji!" });
  }

  const originalNext = current.nextLineId;

  //  Prelamanje teksta (20 riječi)
  const expanded = newText.flatMap(t => wrapTextIntoLines(t, 20));

  // Update postojeće linije
  current.text = expanded[0];
  await current.save();

  await Delta.create({
    scenarioId,
    type: "line_update",
    lineId: current.lineId,
    nextLineId: originalNext,
    content: current.text,
    timestamp: unixTimestampSeconds()
  });

  //  Dodavanje novih linija (BEZ DIRANJA POSTOJEĆIH lineId!)
  let last = current;
  let nextId = Math.max(...lines.map(l => l.lineId)) + 1;

  for (let i = 1; i < expanded.length; i++) {
    const nl = await Line.create({
      scenarioId,
      lineId: nextId,
      text: expanded[i],
      nextLineId: null
    });

    last.nextLineId = nl.lineId;
    await last.save();

    await Delta.create({
      scenarioId,
      type: "line_update",
      lineId: nl.lineId,
      nextLineId: null,
      content: nl.text,
      timestamp: unixTimestampSeconds()
    });

    last = nl;
    nextId++;
  }

  //  Zatvori lanac
  last.nextLineId = originalNext ?? null;
  await last.save();

  //  Otključavanje
  lineLocks.delete(key);
  userLocks.delete(userId);

  return res.status(200).json({ message: "Linija je uspjesno azurirana!" });
});


// RENAME CHARACTER (CASE-SENSITIVE)
app.post("/api/scenarios/:scenarioId/characters/update", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const { userId, oldName, newName } = req.body;

  const lines = await Line.findAll({ where: { scenarioId } });

  for (const l of lines) {
    l.text = l.text.split(oldName).join(newName); 
    await l.save();
  }

  await Delta.create({
    scenarioId,
    type: "char_rename",
    oldName,
    newName,
    timestamp: unixTimestampSeconds()
  });

  res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
});

// GET DELTAS (since)
app.get("/api/scenarios/:scenarioId/deltas", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const since = Number(req.query.since ?? 0);

  const scenario = await Scenario.findByPk(scenarioId);
  if (!scenario)
    return res.status(404).json({ message: "Scenario ne postoji!" });

  const deltas = await Delta.findAll({
    where: {
      scenarioId,
      timestamp: { [Op.gt]: since }
    },
    order: [["timestamp", "ASC"]]
  });

  res.status(200).json({ deltas });
});


// POST /checkpoint
app.post("/api/scenarios/:scenarioId/checkpoint", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);

  const scenario = await Scenario.findByPk(scenarioId);
  if (!scenario) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  await Checkpoint.create({
    scenarioId,
    timestamp: unixTimestampSeconds()
  });

  return res.status(200).json({
    message: "Checkpoint je uspjesno kreiran!"
  });
});

//GET /checkpoints
app.get("/api/scenarios/:scenarioId/checkpoints", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);

  const scenario = await Scenario.findByPk(scenarioId);
  if (!scenario) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const checkpoints = await Checkpoint.findAll({
    where: { scenarioId },
    order: [["timestamp", "ASC"]],
    attributes: ["id", "timestamp"]
  });

  return res.status(200).json(checkpoints);
});

// GET /restore/:checkpointId


app.get("/api/scenarios/:scenarioId/restore/:checkpointId", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const checkpointId = Number(req.params.checkpointId);

  const scenario = await Scenario.findByPk(scenarioId);
  if (!scenario) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const checkpoint = await Checkpoint.findOne({
    where: { id: checkpointId, scenarioId }
  });

  if (!checkpoint) {
    return res.status(404).json({ message: "Checkpoint ne postoji!" });
  }

  //  početno stanje = stanje odmah nakon POST /api/scenarios
  let lines = await Line.findAll({
    where: { scenarioId },
    order: [["lineId", "ASC"]]
  });

  let state = lines.map(l => ({
    lineId: l.lineId,
    text: l.text,
    nextLineId: l.nextLineId
  }));

  //  dohvati sve delte do timestampa checkpointa
  const deltas = await Delta.findAll({
    where: {
      scenarioId,
      timestamp: { [Op.lte]: checkpoint.timestamp }
    },
    order: [["timestamp", "ASC"]]
  });

  //  primijeni delte redom
  for (const d of deltas) {
    if (d.type === "line_update") {
      const line = state.find(l => l.lineId === d.lineId);
      if (line) {
        line.text = d.content;
        line.nextLineId = d.nextLineId;
      }
    }

    if (d.type === "char_rename") {
      state = state.map(l => ({
        ...l,
        text: l.text.split(d.oldName).join(d.newName)
      }));
    }
  }

  //  sortiraj po nextLineId logici (isti helper)
  const ordered = orderLinesByLinks(state);

  return res.status(200).json({
    id: scenario.id,
    title: scenario.title,
    content: ordered
  });
});

// =====================
// START
// =====================
sequelize.sync({ force: true }).then(async () => {
  await seedScenarioIfEmpty();

  app.listen(3000, () =>
    console.log("Server radi na http://localhost:3000")
  );
});


async function seedScenarioIfEmpty() {
  const count = await Scenario.count();
  if (count > 0) return;

  const scenario = await Scenario.create({
    id: 1,
    title: "Potraga za izgubljenim ključem"
  });

  await Line.bulkCreate([
    {
      scenarioId: 1,
      lineId: 1,
      nextLineId: 2,
      text: "NARATOR: Sunce je polako zalazilo nad starim gradom."
    },
    {
      scenarioId: 1,
      lineId: 2,
      nextLineId: 3,
      text: "ALICE: Jesi li siguran da je ključ ostao u biblioteci?"
    },
    {
      scenarioId: 1,
      lineId: 3,
      nextLineId: 4,
      text: "BOB: To je posljednje mjesto gdje sam ga vidio prije nego što je pala noć."
    },
    {
      scenarioId: 1,
      lineId: 4,
      nextLineId: 5,
      text: "ALICE: Moramo požuriti prije nego što čuvar zaključa glavna vrata."
    },
    {
      scenarioId: 1,
      lineId: 5,
      nextLineId: 6,
      text: "BOB: Čekaj, čuješ li taj zvuk iza polica?"
    },
    {
      scenarioId: 1,
      lineId: 6,
      nextLineId: null,
      text: "NARATOR: Iz sjene se polako pojavila nepoznata figura."
    }
  ]);

  console.log("Seed scenario ubačen ");
}

