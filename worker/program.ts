import Fuse from "fuse.js";
import programData from "../src/data/program-data.json";
import type { AppData, ProgramItem } from "../src/types";

export type ListTopicsInput = { query?: string; limit?: number };
export type ListTopicItemsInput = { topicId: number; limit?: number };
export type ListRelatedItemsInput = { itemId: string; limit?: number };
export type SearchProgramsInput = { query: string; limit?: number };
export type SearchPeopleInput = { query: string; limit?: number };
export type FindPeopleByTopicInput = { query: string; limit?: number };

export const data = programData as AppData;
export const itemById = new Map(data.items.map((item) => [item.id, item]));
export const personBySlug = new Map(data.people.map((person) => [person.slug, person]));
export const clusterById = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));

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

export function searchItems(query: string, limit = 12) {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const terms = [
    ...new Set(
      normalizedQuery
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 1),
    ),
  ];

  const candidates = terms.length
    ? data.items
        .map((item) => {
          const text = textForSearch(item);
          const hits = terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
          const titleHits = terms.reduce(
            (count, term) => count + (item.title.toLocaleLowerCase().includes(term) ? 2 : 0),
            0,
          );
          const exactPhraseBoost = normalizedQuery && text.includes(normalizedQuery) ? 6 : 0;
          const recommendationBoost = item.ranking ? Math.max(0, item.ranking.score - 0.72) * 4 : 0;
          return { item, score: hits + titleHits + exactPhraseBoost + recommendationBoost };
        })
        .filter((entry) => entry.score > 0)
    : data.items
        .filter((item) => item.ranking)
        .map((item) => ({ item, score: item.ranking?.score || 0 }));

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchPeople(query: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...data.people]
      .sort((a, b) => b.itemIds.length - a.itemIds.length || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((person) => ({ person, score: 1 }));
  }
  return peopleFuse.search(trimmed, { limit }).map((result) => ({
    person: result.item,
    score: 1 - (result.score ?? 1),
  }));
}

export function findPeopleByTopic(query: string, limit = 12) {
  const matches = searchItems(query, 40);
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

function topicItemScore(item: ProgramItem, topicId: number) {
  const assignment = data.clusterByItem[item.id];
  if (!assignment || assignment.primary !== topicId) return null;
  return assignment.top.find((entry) => entry.clusterId === topicId)?.score ?? 0;
}

export function topicSummaries() {
  const counts = new Map<number, number>();
  for (const assignment of Object.values(data.clusterByItem)) {
    counts.set(assignment.primary, (counts.get(assignment.primary) || 0) + 1);
  }
  return data.clusters.map((topic) => ({
    ...topic,
    itemCount: counts.get(topic.id) || 0,
  }));
}

export function searchTopicSummaries(query: string, limit: number) {
  const terms = query
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1);
  const topics = topicSummaries();
  if (!terms.length) return topics.slice(0, limit);
  return topics
    .map((topic) => {
      const text = `${topic.label} ${topic.description}`.toLocaleLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { topic, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.topic.itemCount - a.topic.itemCount)
    .slice(0, limit)
    .map(({ topic }) => topic);
}

export function itemsForTopic(topicId: number, limit: number) {
  return data.items
    .map((item) => {
      const score = topicItemScore(item, topicId);
      return score === null ? null : { item, score };
    })
    .filter((entry): entry is { item: ProgramItem; score: number } => Boolean(entry))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.startH ?? 99) - (b.item.startH ?? 99) ||
        a.item.title.localeCompare(b.item.title),
    )
    .slice(0, limit);
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
  return (data.related[id] || [])
    .map((entry) => ({ score: entry.score, item: itemById.get(entry.id) }))
    .filter((entry): entry is { score: number; item: ProgramItem } => Boolean(entry.item));
}
