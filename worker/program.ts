import Fuse from "fuse.js";
import programData from "../src/data/program-data.json";
import vectorIndexData from "../src/data/vector-index.json";
import type { AppData, ProgramItem } from "../src/types";

export type ListTopicsInput = { query?: string; limit?: number };
export type ListTopicItemsInput = { topicId: number; limit?: number };
export type ListRelatedItemsInput = { itemId: string; limit?: number };
export type SearchProgramsInput = { query: string; limit?: number };
export type SearchPeopleInput = { query: string; limit?: number };
export type FindPeopleByTopicInput = { query: string; limit?: number };

export const TOPIC_PERSON_RETRIEVAL_LIMIT = 120;
const VECTOR_SEARCH_CANDIDATE_LIMIT = 120;
const VECTOR_SEARCH_MIN_SCORE = 0.2;
const VECTOR_SEARCH_LEXICAL_WEIGHT = 0.2;

export const data = programData as AppData;
const vectorIndex = vectorIndexData as {
  model: string;
  dimensions: number;
  records: { id: string; vector: number[] }[];
};
export const itemById = new Map(data.items.map((item) => [item.id, item]));
export const itemBySourceKey = new Map(data.items.map((item) => [item.sourceKey, item]));
export const personBySlug = new Map(data.people.map((person) => [person.slug, person]));
export const clusterById = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));

type ProgramSearchRow = {
  item: ProgramItem;
  text: string;
  titleText: string;
  recommendationBoost: number;
};

const SEARCH_STOPWORDS = new Set([
  "about",
  "are",
  "can",
  "find",
  "for",
  "from",
  "give",
  "how",
  "items",
  "list",
  "me",
  "on",
  "see",
  "show",
  "some",
  "suggest",
  "talk",
  "talks",
  "the",
  "there",
  "what",
  "work",
  "works",
]);

const peopleFuse = new Fuse(data.people, {
  keys: [
    { name: "name", weight: 3 },
    { name: "roles", weight: 0.5 },
  ],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
});

export function limitParam(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function limitNumber(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value) || !value || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export function itemId(kind: string, id: string) {
  return `${kind}:${id}`;
}

export function resolveItem(kind: string, id: string) {
  const key = itemId(kind, id);
  return itemById.get(key) || itemById.get(data.itemAliases?.[key] || "") || itemBySourceKey.get(key) || null;
}

function textForSearch(item: ProgramItem) {
  return [
    item.id,
    item.title,
    item.abstract,
    item.sessionTitle,
    item.kind,
    item.type,
    item.dayKey,
    item.dayLabel,
    item.time,
    item.room,
    item.presenter,
    item.chair,
    item.authors,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function searchTerms(query: string) {
  return [
    ...new Set(
      query
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 1 && !SEARCH_STOPWORDS.has(term)),
    ),
  ];
}

function topicItemScore(item: ProgramItem, topicId: number) {
  const assignment = data.clusterByItem[item.id];
  if (!assignment || assignment.primary !== topicId) return null;
  return assignment.top.find((entry) => entry.clusterId === topicId)?.score ?? 0;
}

const searchableItems: ProgramSearchRow[] = data.items.map((item) => ({
  item,
  text: textForSearch(item),
  titleText: item.title.toLocaleLowerCase(),
  recommendationBoost: item.ranking ? Math.max(0, item.ranking.score - 0.72) * 4 : 0,
}));

const rankedItemResults = data.items
  .filter((item) => item.ranking)
  .map((item) => ({ item, score: item.ranking?.score || 0 }))
  .sort((a, b) => b.score - a.score);

const popularPeopleResults = [...data.people]
  .sort((a, b) => b.itemIds.length - a.itemIds.length || a.name.localeCompare(b.name))
  .map((person) => ({ person, score: 1 }));

const topicItemCounts = new Map<number, number>();
for (const assignment of Object.values(data.clusterByItem)) {
  topicItemCounts.set(assignment.primary, (topicItemCounts.get(assignment.primary) || 0) + 1);
}

const topicSummaryRows = data.clusters.map((topic) => ({
  ...topic,
  itemCount: topicItemCounts.get(topic.id) || 0,
}));

const topicSearchRows = topicSummaryRows.map((topic) => ({
  topic,
  text: `${topic.label} ${topic.description}`.toLocaleLowerCase(),
}));

const itemsByTopic = new Map<number, { item: ProgramItem; score: number }[]>();
for (const topic of data.clusters) {
  const topicItems = data.items
    .map((item) => {
      const score = topicItemScore(item, topic.id);
      return score === null ? null : { item, score };
    })
    .filter((entry): entry is { item: ProgramItem; score: number } => Boolean(entry))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.startH ?? 99) - (b.item.startH ?? 99) ||
        a.item.title.localeCompare(b.item.title),
    );
  itemsByTopic.set(topic.id, topicItems);
}

const relatedItemsById = new Map<string, { score: number; item: ProgramItem }[]>(
  Object.entries(data.related).map(([id, related]) => [
    id,
    related
      .map((entry) => ({ score: entry.score, item: itemById.get(entry.id) }))
      .filter((entry): entry is { score: number; item: ProgramItem } => Boolean(entry.item)),
  ]),
);

export function searchItems(query: string, limit = 12) {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const terms = searchTerms(normalizedQuery);

  if (!terms.length) return rankedItemResults.slice(0, limit);

  const candidates: { item: ProgramItem; score: number }[] = [];
  for (const { item, text, titleText, recommendationBoost } of searchableItems) {
    let hits = 0;
    let titleHits = 0;
    for (const term of terms) {
      if (text.includes(term)) hits += 1;
      if (titleText.includes(term)) titleHits += 2;
    }
    const exactPhraseBoost = normalizedQuery && text.includes(normalizedQuery) ? 6 : 0;
    const score = hits + titleHits + exactPhraseBoost + recommendationBoost;
    if (score > 0) candidates.push({ item, score });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

function l2Normalize(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

function normalizeVector(values: unknown, dimensions: number) {
  if (!Array.isArray(values)) return [];
  const vector = values.slice(0, dimensions).map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  while (vector.length < dimensions) vector.push(0);
  return l2Normalize(vector);
}

function dot(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += left[index] * right[index];
  return sum;
}

async function embedQuery(query: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${vectorIndex.model}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: vectorIndex.dimensions,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding failed HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { embedding?: { values?: unknown } };
  const vector = normalizeVector(payload.embedding?.values, vectorIndex.dimensions);
  if (vector.length !== vectorIndex.dimensions) {
    throw new Error("Gemini embedding response did not include a usable vector.");
  }
  return vector;
}

export async function searchItemsVector(query: string, apiKey: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed || !apiKey) return searchItems(query, limit);

  const queryVector = await embedQuery(trimmed, apiKey);
  const vectorResults = vectorIndex.records
    .map((record) => ({
      item: itemById.get(record.id),
      vectorScore: dot(queryVector, record.vector),
    }))
    .filter(
      (entry): entry is { item: ProgramItem; vectorScore: number } =>
        Boolean(entry.item) && entry.vectorScore >= VECTOR_SEARCH_MIN_SCORE,
    )
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, Math.max(limit, VECTOR_SEARCH_CANDIDATE_LIMIT));

  const lexicalResults = searchItems(trimmed, Math.max(limit, VECTOR_SEARCH_CANDIDATE_LIMIT));
  const maxLexicalScore = Math.max(...lexicalResults.map((entry) => entry.score), 1);
  const resultsById = new Map<string, { item: ProgramItem; vectorScore: number; lexicalScore: number }>();

  for (const { item, vectorScore } of vectorResults) {
    resultsById.set(item.id, { item, vectorScore, lexicalScore: 0 });
  }

  for (const { item, score } of lexicalResults) {
    const existing = resultsById.get(item.id);
    if (existing) existing.lexicalScore = Math.max(existing.lexicalScore, score / maxLexicalScore);
    else resultsById.set(item.id, { item, vectorScore: 0, lexicalScore: score / maxLexicalScore });
  }

  return [...resultsById.values()]
    .map(({ item, vectorScore, lexicalScore }) => ({
      item,
      score: vectorScore + lexicalScore * VECTOR_SEARCH_LEXICAL_WEIGHT,
      vectorScore,
      lexicalScore,
    }))
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit);
}

export function searchPeople(query: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed) {
    return popularPeopleResults.slice(0, limit);
  }
  return peopleFuse.search(trimmed, { limit }).map((result) => ({
    person: result.item,
    score: 1 - (result.score ?? 1),
  }));
}

function peopleByTopicFromMatches(
  matches: { item: ProgramItem; score: number }[],
  limit: number,
) {
  const peopleById = new Map<
    string,
    {
      person: {
        id: string;
        slug: string;
        name: string;
        roles: string[];
        path: string;
      };
      score: number;
      itemIds: Set<string>;
      items: ReturnType<typeof compactItemSummary>[];
    }
  >();

  for (const { item, score } of matches) {
    for (const person of data.peopleByItem[item.id] || []) {
      const existing = peopleById.get(person.id);
      if (existing) {
        existing.score += score;
        if (!existing.itemIds.has(item.id)) {
          existing.itemIds.add(item.id);
          existing.items.push(compactItemSummary(item));
        }
        continue;
      }

      peopleById.set(person.id, {
        person: {
          id: person.id,
          slug: person.slug,
          name: person.name,
          roles: person.roles,
          path: `/people/${person.slug}`,
        },
        score,
        itemIds: new Set([item.id]),
        items: [compactItemSummary(item)],
      });
    }
  }

  return [...peopleById.values()]
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .slice(0, limit)
    .map((entry) => ({
      score: entry.score,
      person: entry.person,
      matchedItemCount: entry.itemIds.size,
      items: entry.items.slice(0, 4),
    }));
}

export function findPeopleByTopic(query: string, limit = 12) {
  return peopleByTopicFromMatches(searchItems(query, TOPIC_PERSON_RETRIEVAL_LIMIT), limit);
}

export async function findPeopleByTopicVector(query: string, apiKey: string, limit = 12) {
  return peopleByTopicFromMatches(
    await searchItemsVector(query, apiKey, TOPIC_PERSON_RETRIEVAL_LIMIT),
    limit,
  );
}

export function linkedPeopleForItem(item: ProgramItem) {
  const people = data.peopleByItem[item.id] || [];
  if (people.length) {
    return people.map((person) => `[${person.name}](/people/${person.slug})`).join(", ");
  }
  return item.presenter || item.authors || item.chair || "";
}

export function compactItemSummary(item: ProgramItem) {
  const people = data.peopleByItem[item.id] || [];
  return {
    id: item.id,
    title: item.title,
    path: pathForItem(item),
    kind: item.kind,
    type: item.type,
    when: [item.dayLabel, item.time].filter(Boolean).join(" | "),
    room: item.room || "TBA",
    people: people.map((person) => ({
      name: person.name,
      path: `/people/${person.slug}`,
      roles: person.roles,
    })),
    peopleText: linkedPeopleForItem(item),
  };
}

export function compactRelatedItems(itemId: string, limit: number) {
  return relatedFor(itemId)
    .slice(0, limit)
    .map(({ item, score }) => ({
      ...compactItemSummary(item),
      similarityScore: score,
    }));
}

export function topicSummaries() {
  return topicSummaryRows.slice();
}

export function searchTopicSummaries(query: string, limit: number) {
  const terms = searchTerms(query.toLocaleLowerCase());
  if (!terms.length) return topicSummaryRows.slice(0, limit);
  return topicSearchRows
    .map(({ topic, text }) => ({
      topic,
      score: terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.topic.itemCount - a.topic.itemCount)
    .slice(0, limit)
    .map(({ topic }) => topic);
}

export function itemsForTopic(topicId: number, limit: number) {
  return (itemsByTopic.get(topicId) || []).slice(0, limit);
}

export function pathForItem(item: ProgramItem) {
  if (item.kind === "session") return `/day/${item.dayKey || data.days.all[0]?.key || "mon"}?item=${item.id}`;
  return `/programs?item=${item.id}`;
}

export function conciseItem(item: ProgramItem, index: number) {
  const people = linkedPeopleForItem(item);
  const abstract = item.abstract ? `\nAbstract: ${item.abstract.slice(0, 700)}` : "";
  const related = compactRelatedItems(item.id, 3);
  return [
    `[${index + 1}]`,
    `ID: ${item.id}`,
    `Title: ${item.title}`,
    `Path: ${pathForItem(item)}`,
    `Type: ${[item.kind, item.type].filter(Boolean).join(" / ")}`,
    `When: ${[item.dayLabel, item.time].filter(Boolean).join(" | ")}`,
    `Room: ${item.room || "TBA"}`,
    people ? `People: ${people}` : "",
    related.length
      ? `Related: ${related
          .map((entry) => `${entry.id} (${entry.similarityScore.toFixed(2)}) ${entry.title}`)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .concat(abstract);
}

export function contextForQuery(query: string) {
  const results = searchItems(query, 10);
  return {
    results,
    text: results.map(({ item }, index) => conciseItem(item, index)).join("\n\n"),
  };
}

export function relatedFor(id: string) {
  return relatedItemsById.get(id)?.slice() || [];
}
