import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const DEFAULT_URL = "https://program.netsci2026.com/";
const DEFAULT_OUT_DIR = "data";

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    input: null,
    outDir: DEFAULT_OUT_DIR,
    pretty: true,
    saveHtml: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") opts.url = argv[++i];
    else if (arg === "--input") opts.input = argv[++i];
    else if (arg === "--out") opts.outDir = argv[++i];
    else if (arg === "--compact") opts.pretty = false;
    else if (arg === "--no-html") opts.saveHtml = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage:
  pnpm extract
  pnpm extract:cached
  pnpm extract -- --url https://program.netsci2026.com/ --out data
  pnpm extract -- --input program.html --compact

Options:
  --url <url>       Program URL to fetch. Default: ${DEFAULT_URL}
  --input <file>    Read an already-downloaded HTML file instead of fetching.
  --out <dir>       Output directory. Default: ${DEFAULT_OUT_DIR}
  --compact         Write compact JSON instead of pretty JSON.
  --no-html         Do not save the fetched/source HTML into the output dir.
`);
}

async function loadHtml(opts) {
  if (opts.input) {
    return readFile(opts.input, "utf8");
  }

  const response = await fetch(opts.url, {
    headers: {
      "user-agent": "netsci2026-program-extractor/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${opts.url}: HTTP ${response.status}`);
  }

  return response.text();
}

function extractProgramData(html, sourceUrl) {
  const startMarker = "/* === DATA === */";
  const endMarker = "/* === STATE === */";
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);

  if (start === -1 || end === -1) {
    throw new Error("Could not find the embedded program data block.");
  }

  const script = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, {
    filename: "netsci2026-program-data.js",
    timeout: 5000,
  });

  const required = ["MAIN_DAYS", "SAT_DAYS", "ALL_DAYS", "TC", "TL", "DN", "SPK", "EV", "POSTERS", "GRAPH"];
  for (const key of required) {
    if (!(key in sandbox)) throw new Error(`Expected ${key} in embedded program data.`);
  }

  return {
    conference: {
      name: "NetSci 2026",
      sourceUrl,
      extractedAt: new Date().toISOString(),
      start: sandbox.CS instanceof Date ? sandbox.CS.toISOString() : null,
      end: sandbox.CE instanceof Date ? sandbox.CE.toISOString() : null,
      defaultRoom: sandbox.DEFAULT_ROOM,
    },
    days: {
      satellite: sandbox.SAT_DAYS,
      main: sandbox.MAIN_DAYS,
      all: sandbox.ALL_DAYS,
      labels: sandbox.DN,
    },
    types: {
      labels: sandbox.TL,
      colors: sandbox.TC,
    },
    speakers: expandSpeakers(sandbox.SPK),
    eventsByDay: sandbox.EV,
    posters: sandbox.POSTERS,
    graphs: {
      talks: sandbox.GRAPH,
      posters: sandbox.PGRAPH ?? null,
    },
  };
}

function expandSpeakers(rawSpeakers) {
  return Object.fromEntries(
    Object.entries(rawSpeakers).map(([key, value]) => [
      key,
      {
        names: value.n ?? [],
        photos: value.p ?? [],
        affiliations: value.a ?? [],
        bios: value.b ?? [],
      },
    ]),
  );
}

function flattenSessions(eventsByDay, dayLabels) {
  const sessions = [];
  for (const [dayKey, events] of Object.entries(eventsByDay)) {
    for (const event of events) {
      sessions.push({
        ...event,
        dayKey,
        dayLabel: dayLabels[dayKey] ?? dayKey,
        talkCount: Array.isArray(event.talks) ? event.talks.length : 0,
      });
    }
  }
  return sessions;
}

function flattenTalks(eventsByDay, dayLabels) {
  const talks = [];
  for (const [dayKey, events] of Object.entries(eventsByDay)) {
    for (const event of events) {
      if (!Array.isArray(event.talks)) continue;
      event.talks.forEach((talk, index) => {
        talks.push({
          ...talk,
          dayKey,
          dayLabel: dayLabels[dayKey] ?? dayKey,
          sessionId: event.id,
          sessionTitle: event.title,
          sessionType: event.type,
          sessionRoom: event.room ?? null,
          sessionTime: event.time,
          sessionStartH: event.startH,
          sessionEndH: event.endH,
          talkIndex: index,
        });
      });
    }
  }
  return talks;
}

async function writeJson(filePath, value, pretty) {
  const json = JSON.stringify(value, null, pretty ? 2 : 0);
  await writeFile(filePath, `${json}\n`, "utf8");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const html = await loadHtml(opts);
  const sourceUrl = opts.input ? path.resolve(opts.input) : opts.url;
  const data = extractProgramData(html, sourceUrl);
  const sessions = flattenSessions(data.eventsByDay, data.days.labels);
  const talks = flattenTalks(data.eventsByDay, data.days.labels);

  await mkdir(opts.outDir, { recursive: true });

  if (opts.saveHtml) {
    await writeFile(path.join(opts.outDir, "program.html"), html, "utf8");
  }

  await writeJson(path.join(opts.outDir, "program.raw.json"), data, opts.pretty);
  await writeJson(path.join(opts.outDir, "days.json"), data.days, opts.pretty);
  await writeJson(path.join(opts.outDir, "types.json"), data.types, opts.pretty);
  await writeJson(path.join(opts.outDir, "speakers.json"), data.speakers, opts.pretty);
  await writeJson(path.join(opts.outDir, "sessions.json"), sessions, opts.pretty);
  await writeJson(path.join(opts.outDir, "talks.json"), talks, opts.pretty);
  await writeJson(path.join(opts.outDir, "posters.json"), data.posters, opts.pretty);
  await writeJson(path.join(opts.outDir, "graphs.json"), data.graphs, opts.pretty);

  console.log(`Extracted ${sessions.length} sessions, ${talks.length} talks, ${data.posters.length} posters.`);
  console.log(`Wrote JSON files to ${path.resolve(opts.outDir)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
