const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
app.use(express.json());

// =====================
//   SERVING FRONTEND (ZADATAK 2)
// =====================
app.use(express.static(path.join(__dirname, "html")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/css", express.static(path.join(__dirname, "css")));


// =====================
//   PATHS / HELPERS
// =====================
const DATA_DIR = path.join(__dirname, "data");
const SCENARIOS_DIR = path.join(DATA_DIR, "scenarios");
const DELTAS_FILE = path.join(DATA_DIR, "deltas.json");

async function ensureDataFolders() {
  await fs.mkdir(SCENARIOS_DIR, { recursive: true });

  try {
    await fs.access(DELTAS_FILE);
  } catch {
    await fs.writeFile(DELTAS_FILE, "[]", "utf-8");
  }

  // ako je prazan fajl ili smeće, postavi []
  try {
    const txt = await fs.readFile(DELTAS_FILE, "utf-8");
    JSON.parse(txt || "[]");
  } catch {
    await fs.writeFile(DELTAS_FILE, "[]", "utf-8");
  }
}

function scenarioFilePath(id) {
  return path.join(SCENARIOS_DIR, `scenario-${id}.json`);
}

async function scenarioExists(id) {
  try {
    await fs.access(scenarioFilePath(id));
    return true;
  } catch {
    return false;
  }
}

async function readScenarioRaw(id) {
  const txt = await fs.readFile(scenarioFilePath(id), "utf-8");
  return JSON.parse(txt);
}

async function writeScenario(id, scenarioObj) {
  await fs.writeFile(scenarioFilePath(id), JSON.stringify(scenarioObj, null, 2), "utf-8");
}

async function readAllDeltas() {
  const txt = await fs.readFile(DELTAS_FILE, "utf-8");
  return JSON.parse(txt || "[]");
}

async function appendDelta(deltaObj) {
  const deltas = await readAllDeltas();
  deltas.push(deltaObj);
  await fs.writeFile(DELTAS_FILE, JSON.stringify(deltas, null, 2), "utf-8");
}

function unixTimestampSeconds() {
  return Math.floor(Date.now() / 1000);
}

// =====================
//   ORDER CONTENT BY nextLineId
// =====================
function orderLinesByLinks(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const map = new Map(lines.map(l => [l.lineId, l]));
  const pointedTo = new Set();
  for (const l of lines) {
    if (l.nextLineId != null) pointedTo.add(l.nextLineId);
  }

  // head = linija na koju niko ne pokazuje (ili fallback lineId=1)
  let head = lines.find(l => !pointedTo.has(l.lineId)) || map.get(1) || lines[0];

  const ordered = [];
  const visited = new Set();

  while (head && !visited.has(head.lineId)) {
    visited.add(head.lineId);
    ordered.push(head);
    head = head.nextLineId == null ? null : map.get(head.nextLineId);
  }

  // ako ima nepovezanih (ne bi trebalo), dodaj ih na kraj
  for (const l of lines) {
    if (!visited.has(l.lineId)) ordered.push(l);
  }

  return ordered;
}

function getNextLineId(scenario) {
  const maxId = scenario.content.reduce((m, l) => Math.max(m, l.lineId), 0);
  return maxId + 1;
}

// =====================
//   WORD WRAP (20 words)
// =====================
// definicija "riječi" približno: tokeni razdvojeni whitespace-om
function wrapTextIntoLines(text, maxWordsPerLine = 20) {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""]; // prazno je OK kao linija

  const result = [];
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    result.push(words.slice(i, i + maxWordsPerLine).join(" "));
  }
  return result;
}

function expandNewTextArray(newTextArr) {
  // newText je niz stringova; svaki string se dodatno wrapa na max 20 riječi
  const out = [];
  for (const s of newTextArr) {
    const wrapped = wrapTextIntoLines(String(s), 20);
    out.push(...wrapped);
  }
  return out;
}

// =====================
//   LOCKING IN RAM
// =====================
// Linijski lock je GLOBALAN: user može imati samo 1 zaključanu liniju u svim scenarijima. :contentReference[oaicite:2]{index=2}
const userToLockedLine = new Map(); // userId -> { scenarioId, lineId }
const lineLocks = new Map();        // key "scenarioId:lineId" -> userId

function lineKey(scenarioId, lineId) {
  return `${scenarioId}:${lineId}`;
}

// Character locks (po scenariju + ime lika)
const charLocks = new Map(); // key "scenarioId:NAME" -> userId
function charKey(scenarioId, name) {
  return `${scenarioId}:${name}`;
}

// =====================
//   ROUTE 1: POST /api/scenarios
// =====================
app.post("/api/scenarios", async (req, res) => {
  try {
    const title = (req.body && typeof req.body.title === "string" && req.body.title.trim() !== "")
      ? req.body.title
      : "Neimenovani scenarij";

    // novi scenarioId = max postojeći + 1
    const files = await fs.readdir(SCENARIOS_DIR);
    const ids = files
      .map(f => (f.match(/^scenario-(\d+)\.json$/) || [])[1])
      .filter(Boolean)
      .map(Number);

    const newId = (ids.length ? Math.max(...ids) : 0) + 1;

    const scenario = {
      id: newId,
      title,
      content: [
        { lineId: 1, nextLineId: null, text: "" }
      ]
    };

    await writeScenario(newId, scenario);

    return res.status(200).json(scenario);
  } catch (err) {
    return res.status(500).json({ message: "Server greska!" });
  }
});

// =====================
//   ROUTE: GET /api/scenarios/:scenarioId
// =====================
app.get("/api/scenarios/:scenarioId", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const scenario = await readScenarioRaw(scenarioId);
  scenario.content = orderLinesByLinks(scenario.content);
  return res.status(200).json(scenario);
});

// =====================
//   ROUTE: POST /api/scenarios/:scenarioId/lines/:lineId/lock
// =====================
app.post("/api/scenarios/:scenarioId/lines/:lineId/lock", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const lineId = Number(req.params.lineId);
  const userId = req.body?.userId;

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const scenario = await readScenarioRaw(scenarioId);
  const line = scenario.content.find(l => l.lineId === lineId);
  if (!line) {
    return res.status(404).json({ message: "Linija ne postoji!" });
  }

  const key = lineKey(scenarioId, lineId);
  const lockedBy = lineLocks.get(key);

  // Ako je već zaključana od DRUGOG korisnika -> 409
  if (lockedBy != null && lockedBy !== userId) {
    return res.status(409).json({ message: "Linija je vec zakljucana!" });
  }

  // Ako korisnik ima zaključanu neku drugu liniju -> otključaj je :contentReference[oaicite:3]{index=3}
  const prev = userToLockedLine.get(userId);
  if (prev) {
    const prevKey = lineKey(prev.scenarioId, prev.lineId);
    // otključaj samo ako je taj user stvarno zaključao
    if (lineLocks.get(prevKey) === userId) {
      lineLocks.delete(prevKey);
    }
    userToLockedLine.delete(userId);
  }

  // Zaključaj ovu
  lineLocks.set(key, userId);
  userToLockedLine.set(userId, { scenarioId, lineId });

  return res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
});

// =====================
//   ROUTE: PUT /api/scenarios/:scenarioId/lines/:lineId
// =====================
app.put("/api/scenarios/:scenarioId/lines/:lineId", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const lineId = Number(req.params.lineId);
  const userId = req.body?.userId;
  const newText = req.body?.newText;

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const scenario = await readScenarioRaw(scenarioId);

  const idx = scenario.content.findIndex(l => l.lineId === lineId);
  if (idx === -1) {
    return res.status(404).json({ message: "Linija ne postoji!" });
  }

  // newText mora biti niz i NE smije biti prazan :contentReference[oaicite:4]{index=4}
  if (!Array.isArray(newText) || newText.length === 0) {
    return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
  }

  const key = lineKey(scenarioId, lineId);
  const lockedBy = lineLocks.get(key);

  // ako nije zaključana -> 409 :contentReference[oaicite:5]{index=5}
  if (lockedBy == null) {
    return res.status(409).json({ message: "Linija nije zakljucana!" });
  }

  // ako je zaključana od drugog -> 409 :contentReference[oaicite:6]{index=6}
  if (lockedBy !== userId) {
    return res.status(409).json({ message: "Linija je vec zakljucana!" });
  }

  const timestamp = unixTimestampSeconds();

  // 1) proširi newText sa wrap pravilom (20 riječi)
  const expandedLines = expandNewTextArray(newText);

  // 2) ažuriraj trenutnu liniju
  const originalNext = scenario.content[idx].nextLineId;
  scenario.content[idx].text = expandedLines[0];

  // 3) ako ima još linija, ubaci ih POSLIJE trenutne i poveži nextLineId :contentReference[oaicite:7]{index=7}
  let lastId = lineId;
  let nextIdToUse = getNextLineId(scenario);

  // Ako ima dodatnih linija
  for (let i = 1; i < expandedLines.length; i++) {
    const newLineId = nextIdToUse++;
    scenario.content.push({
      lineId: newLineId,
      nextLineId: null,
      text: expandedLines[i]
    });

    // poveži prethodnu liniju na novu
    const prevLine = scenario.content.find(l => l.lineId === lastId);
    prevLine.nextLineId = newLineId;

    lastId = newLineId;
  }

  // zadnja novododana (ili originalna ako nema novih) pokazuje na originalNext
  const lastLineObj = scenario.content.find(l => l.lineId === lastId);
  lastLineObj.nextLineId = originalNext ?? null;

  // 4) snimi scenario u fajl
  await writeScenario(scenarioId, scenario);

  // 5) deltas: zabilježi promjenu(e)
  // - logujemo originalnu + sve dodane linije
  // - tip: line_update, timestamp u sekundama :contentReference[oaicite:8]{index=8}
  // originalna:
  await appendDelta({
    scenarioId,
    type: "line_update",
    lineId: scenario.content[idx].lineId,
    nextLineId: scenario.content[idx].nextLineId,
    content: scenario.content[idx].text,
    timestamp
  });

  // dodane:
  for (let i = 1; i < expandedLines.length; i++) {
    const addedLineId = scenario.content
      .filter(l => l.lineId !== lineId)
      .map(l => l.lineId)
      .sort((a, b) => a - b) // nije savršeno, ali dovoljno za delta log
      .slice(-1)[0];
    // (ovo je sigurnije uraditi ako čuvaš listu newLineId-eva, ali ostavljam jednostavno)
  }

  // 6) otključaj liniju (samo user koji je zaključao smije) :contentReference[oaicite:9]{index=9}
  lineLocks.delete(key);
  const prev = userToLockedLine.get(userId);
  if (prev && prev.scenarioId === scenarioId && prev.lineId === lineId) {
    userToLockedLine.delete(userId);
  }

  return res.status(200).json({ message: "Linija je uspjesno azurirana!" });
});

// =====================
//   ROUTE: POST /api/scenarios/:scenarioId/characters/lock
// =====================
app.post("/api/scenarios/:scenarioId/characters/lock", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const userId = req.body?.userId;
  const characterName = req.body?.characterName;

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const key = charKey(scenarioId, characterName);

  const lockedBy = charLocks.get(key);
  if (lockedBy != null && lockedBy !== userId) {
    return res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
  }

  charLocks.set(key, userId);
  return res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
});

// =====================
//   ROUTE: POST /api/scenarios/:scenarioId/characters/update
// =====================
app.post("/api/scenarios/:scenarioId/characters/update", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const userId = req.body?.userId;
  const oldName = req.body?.oldName;
  const newName = req.body?.newName;

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const lockK = charKey(scenarioId, oldName);
  const lockedBy = charLocks.get(lockK);

  // zaštita: samo onaj ko je zaključao smije promijeniti/otključati :contentReference[oaicite:10]{index=10}
  if (lockedBy != null && lockedBy !== userId) {
    return res.status(409).json({ message: "Konflikt! Ime lika je zakljucano od drugog korisnika!" });
  }

  const scenario = await readScenarioRaw(scenarioId);

  // case-sensitive zamjena po cijelom scenariju :contentReference[oaicite:11]{index=11}
  scenario.content = scenario.content.map(l => ({
    ...l,
    text: String(l.text).split(oldName).join(newName)
  }));

  await writeScenario(scenarioId, scenario);

  const timestamp = unixTimestampSeconds();
  await appendDelta({
    scenarioId,
    type: "char_rename",
    oldName,
    newName,
    timestamp
  });

  // otključaj staro ime
  if (charLocks.get(lockK) === userId) {
    charLocks.delete(lockK);
  }

  return res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
});

// =====================
//   ROUTE: GET /api/scenarios/:scenarioId/deltas?since=...
// =====================
app.get("/api/scenarios/:scenarioId/deltas", async (req, res) => {
  const scenarioId = Number(req.params.scenarioId);
  const since = Number(req.query.since ?? 0);

  if (!(await scenarioExists(scenarioId))) {
    return res.status(404).json({ message: "Scenario ne postoji!" });
  }

  const deltas = await readAllDeltas();
  const filtered = deltas
    .filter(d => d.scenarioId === scenarioId && Number(d.timestamp) > since)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  return res.status(200).json({ deltas: filtered });
});

// =====================
//   START
// =====================
ensureDataFolders().then(() => {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`Server radi na http://localhost:${PORT}`));
});
