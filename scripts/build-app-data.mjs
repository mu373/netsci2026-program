import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const outDir = path.join(root, "src", "data");
const outPath = path.join(outDir, "program-data.json");
const vectorIndexPath = path.join(outDir, "vector-index.json");
const personVectorsPath = path.join(dataDir, "similarity-content", "person-vectors.jsonl");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""),
  );
}

function withoutGeneratedAt(payload) {
  const { generatedAt, ...rest } = payload;
  return rest;
}

function stableGeneratedAt(payloadWithoutGeneratedAt, fallback = new Date().toISOString()) {
  if (!fs.existsSync(outPath)) return fallback;

  try {
    const previousPayload = readJsonFile(outPath);
    const previousGeneratedAt = previousPayload.generatedAt;
    if (
      typeof previousGeneratedAt === "string" &&
      JSON.stringify(withoutGeneratedAt(previousPayload)) === JSON.stringify(payloadWithoutGeneratedAt)
    ) {
      return previousGeneratedAt;
    }
  } catch {
    // Fall through to a fresh timestamp when the existing generated file is unreadable.
  }

  return fallback;
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  const base = compact(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "person";
}

const CANONICAL_PERSON_BY_SLUG = new Map([
  ["albert-laszlo-barabasi", "Albert-László Barabási"],
  ["laszlo-barabasi", "Albert-László Barabási"],
]);

function canonicalPersonName(value) {
  const clean = compact(value);
  return CANONICAL_PERSON_BY_SLUG.get(slugify(clean)) || clean;
}

function normalizeKnownPersonMentions(value) {
  return compact(value)
    .replace(/Barabasi,\s*Albert-Laszlo/g, "Barabási, Albert-László")
    .replace(/László Barabási,\s*Albert/g, "Barabási, Albert-László")
    .replace(/(^|[^-])\bLászló Barabási\b/g, "$1Albert-László Barabási");
}

function authorName(raw) {
  const clean = normalizeKnownPersonMentions(raw).replace(/\*/g, "");
  const parts = clean.split(",").map((part) => compact(part));
  if (parts.length >= 2) return canonicalPersonName(`${parts.slice(1).join(" ")} ${parts[0]}`);
  return canonicalPersonName(clean);
}

function parseAuthors(value) {
  return compact(value)
    .split(";")
    .map(authorName)
    .filter(Boolean);
}

function parseNameList(value) {
  return normalizeKnownPersonMentions(value)
    .replace(/\s*&\s*/g, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .split(/\s*,\s*|\s*;\s*/)
    .map(compact)
    .map(canonicalPersonName)
    .filter(Boolean);
}

function normalizeNameList(value) {
  return parseNameList(value).join(", ");
}

function formatHour(value) {
  if (value === null || value === undefined) return "";
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`.replace(":00", "");
}

function normalizedTime(record) {
  if (record.startH !== undefined && record.startH !== null && record.endH !== undefined && record.endH !== null) {
    return `${formatHour(record.startH)} - ${formatHour(record.endH)}`;
  }
  return compact(record.time);
}

function addPerson(peopleByName, name, role, itemId) {
  const clean = canonicalPersonName(name);
  if (!clean) return;
  const key = clean.toLocaleLowerCase();
  if (!peopleByName.has(key)) {
    peopleByName.set(key, {
      id: `person:${slugify(clean)}`,
      slug: slugify(clean),
      name: clean,
      roles: [],
      itemIds: [],
    });
  }
  const person = peopleByName.get(key);
  if (!person.roles.includes(role)) person.roles.push(role);
  if (!person.itemIds.includes(itemId)) person.itemIds.push(itemId);
}

function dedupeSlugs(people) {
  const seen = new Map();
  for (const person of people) {
    const count = seen.get(person.slug) || 0;
    seen.set(person.slug, count + 1);
    if (count > 0) {
      person.slug = `${person.slug}-${count + 1}`;
      person.id = `person:${person.slug}`;
    }
  }
}

function dot(a, b) {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) sum += a[index] * b[index];
  return sum;
}

function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

function meanVector(vectors) {
  const dimensions = vectors.find((vector) => Array.isArray(vector) && vector.length > 0)?.length || 0;
  if (!dimensions) return [];
  const sum = Array.from({ length: dimensions }, () => 0);
  let count = 0;
  for (const vector of vectors) {
    if (!Array.isArray(vector) || vector.length !== dimensions) continue;
    for (let index = 0; index < dimensions; index += 1) sum[index] += vector[index];
    count += 1;
  }
  if (!count) return [];
  return l2Normalize(sum.map((value) => value / count));
}

function sharedCount(left, right) {
  const rightSet = new Set(right);
  return left.reduce((count, value) => count + (rightSet.has(value) ? 1 : 0), 0);
}

const days = readJson("data/days.json");
const sessions = readJson("data/sessions.json");
const talks = readJson("data/talks.json");
const posters = readJson("data/posters.json");
const vectors = readJsonl("data/similarity-content/netsci-vectors.jsonl");
const clusterData = readJson("data/similarity-content/netsci-clusters.json");

const clusterById = new Map(
  clusterData.clusters.map((c) => [
    c.clusterId,
    {
      id: c.clusterId,
      label: c.label,
      description: c.description,
      size: c.size,
    },
  ]),
);
const clusterAssignByItem = new Map(
  clusterData.assignments.map((a) => [
    a.id,
    {
      clusterId: a.clusterId,
      probability: a.probability,
      topClusters: a.topClusters || [],
    },
  ]),
);

const rankingById = new Map();

const peopleByName = new Map();
const items = [];

for (const session of sessions) {
  const id = `session:${session.id}`;
  const item = {
    id,
    sourceId: session.id,
    kind: "session",
    title: compact(session.title),
    abstract: compact(session.abstract || session.desc || session.talkTitle),
    type: session.type || "session",
    dayKey: session.dayKey || "",
    dayLabel: session.dayLabel || "",
    time: normalizedTime(session),
    startH: session.startH ?? null,
    endH: session.endH ?? null,
    room: session.room || "",
    presenter: normalizeNameList(session.presenter),
    chair: normalizeNameList(session.chair),
    authors: "",
    url: compact(session.url),
    sessionId: "",
    sessionTitle: "",
    posterNum: null,
    talkCount: session.talkCount || 0,
    ranking: rankingById.get(id) || null,
  };
  items.push(item);
  for (const presenter of parseNameList(item.presenter)) addPerson(peopleByName, presenter, "presenter", id);
  for (const chair of parseNameList(item.chair)) addPerson(peopleByName, chair, "chair", id);
}

for (const talk of talks) {
  const id = `talk:${talk.id}`;
  const item = {
    id,
    sourceId: String(talk.id),
    kind: "talk",
    title: compact(talk.title),
    abstract: compact(talk.abstract),
    type: talk.sessionType || "talk",
    dayKey: talk.dayKey || "",
    dayLabel: talk.dayLabel || "",
    time: normalizedTime(talk),
    startH: null,
    endH: null,
    room: talk.sessionRoom || "",
    presenter: normalizeNameList(talk.presenter),
    chair: "",
    authors: normalizeKnownPersonMentions(talk.authors),
    url: "",
    sessionId: talk.sessionId || "",
    sessionTitle: talk.sessionTitle || "",
    posterNum: null,
    talkIndex: talk.talkIndex ?? null,
    ranking: rankingById.get(id) || null,
  };
  items.push(item);
  for (const presenter of parseNameList(item.presenter)) addPerson(peopleByName, presenter, "presenter", id);
  for (const author of parseAuthors(item.authors)) addPerson(peopleByName, author, "author", id);
}

for (const poster of posters) {
  const id = `poster:${poster.num}`;
  const item = {
    id,
    sourceId: String(poster.num),
    kind: "poster",
    title: compact(poster.title),
    abstract: compact(poster.abstract),
    type: "poster",
    dayKey: "",
    dayLabel: "",
    time: "",
    startH: null,
    endH: null,
    room: "Poster Hall",
    presenter: normalizeNameList(poster.presenter),
    chair: "",
    authors: normalizeKnownPersonMentions(poster.authors),
    url: "",
    sessionId: "",
    sessionTitle: "",
    posterNum: poster.posterNum ?? poster.num,
    ranking: rankingById.get(id) || null,
  };
  items.push(item);
  for (const presenter of parseNameList(item.presenter)) addPerson(peopleByName, presenter, "presenter", id);
  for (const author of parseAuthors(item.authors)) addPerson(peopleByName, author, "author", id);
}

const related = {};
const vectorRecords = vectors.filter((record) => Array.isArray(record.vector));
const vectorById = new Map(vectorRecords.map((record) => [record.id, record.vector]));
const RELATED_PEOPLE_MIN_SCORE = 0.9;
const RELATED_PEOPLE_LIMIT = 15;
for (const record of vectorRecords) {
  const scores = [];
  for (const candidate of vectorRecords) {
    if (candidate.id === record.id) continue;
    scores.push({ id: candidate.id, score: dot(record.vector, candidate.vector) });
  }
  scores.sort((a, b) => b.score - a.score);
  related[record.id] = scores.slice(0, 10);
}

const people = [...peopleByName.values()].sort((a, b) => a.name.localeCompare(b.name));
dedupeSlugs(people);
const personVectorRecords = [];
for (const person of people) {
  const vectorItemIds = person.itemIds.filter((itemId) => vectorById.has(itemId));
  const vector = meanVector(vectorItemIds.map((itemId) => vectorById.get(itemId)));
  person.embedding = vector.length
    ? {
        itemCount: vectorItemIds.length,
        dimensions: vector.length,
      }
    : null;
  if (vector.length) {
    personVectorRecords.push({
      id: person.id,
      slug: person.slug,
      name: person.name,
      roles: person.roles,
      itemIds: vectorItemIds,
      itemCount: vectorItemIds.length,
      model: vectorRecords[0]?.model || "gemini-embedding-2-preview",
      dimensions: vector.length,
      vector,
    });
  }
}
writeJsonl(personVectorsPath, personVectorRecords);
const relatedPeople = {};
for (const record of personVectorRecords) {
  const scores = [];
  for (const candidate of personVectorRecords) {
    if (candidate.id === record.id) continue;
    scores.push({
      id: candidate.id,
      score: dot(record.vector, candidate.vector),
      sharedItemCount: sharedCount(record.itemIds, candidate.itemIds),
    });
  }
  scores.sort((a, b) => b.score - a.score || b.sharedItemCount - a.sharedItemCount);
  relatedPeople[record.id] = scores
    .filter((entry) => entry.score > RELATED_PEOPLE_MIN_SCORE)
    .slice(0, RELATED_PEOPLE_LIMIT);
}
const peopleByItem = {};
for (const person of people) {
  for (const itemId of person.itemIds) {
    if (!peopleByItem[itemId]) peopleByItem[itemId] = [];
    peopleByItem[itemId].push({ id: person.id, slug: person.slug, name: person.name, roles: person.roles });
  }
}

const clusters = [...clusterById.values()].sort((a, b) => b.size - a.size);
const clusterByItem = {};
for (const item of items) {
  const assign = clusterAssignByItem.get(item.id);
  if (!assign) continue;
  clusterByItem[item.id] = {
    primary: assign.clusterId,
    probability: assign.probability,
    top: assign.topClusters.map((t) => ({ clusterId: t.clusterId, score: t.score })),
  };
}

const payloadWithoutGeneratedAt = {
  days,
  items,
  people,
  peopleByItem,
  relatedPeople,
  related,
  clusters,
  clusterByItem,
  rankingMeta: {
    model: vectorRecords[0]?.model || "gemini-embedding-2-preview",
    netsciCount: vectorRecords.length,
    namedVectors: [],
    centroidCount: 0,
    personVectorCount: personVectorRecords.length,
  },
};
const payload = {
  generatedAt: stableGeneratedAt(payloadWithoutGeneratedAt),
  ...payloadWithoutGeneratedAt,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`);

const itemVectorRecordsForIndex = readJsonl("data/similarity-content/netsci-vectors.jsonl");
const vectorIndex = {
  model: itemVectorRecordsForIndex[0]?.model || "gemini-embedding-2-preview",
  dimensions: itemVectorRecordsForIndex[0]?.dimensions || 512,
  count: itemVectorRecordsForIndex.length,
  records: itemVectorRecordsForIndex.map((record) => ({
    id: record.id,
    vector: record.vector,
  })),
};
fs.writeFileSync(vectorIndexPath, `${JSON.stringify(vectorIndex)}\n`);

console.log(
  `Wrote ${items.length} items, ${people.length} people, ${personVectorRecords.length} person vectors, ${itemVectorRecordsForIndex.length} item vectors, and ${Object.keys(related).length} related item lists to ${outPath}`,
);
console.log(`Wrote person vectors to ${personVectorsPath}`);
console.log(`Wrote item vector index to ${vectorIndexPath}`);
