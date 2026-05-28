import Fuse from "fuse.js";
import programDataUrl from "./data/program-data.json?url";
import type { AppData, Cluster, ItemClusterAssignment, Person, ProgramItem } from "./types";

const rawData = await fetch(programDataUrl).then((response) => {
  if (!response.ok) {
    throw new Error(`Could not load program data: ${response.status}`);
  }
  return response.json() as Promise<AppData>;
});

export const data = rawData as AppData;

export const items = data.items;
export const people = data.people;
export const clusters = data.clusters;

export const itemById = new Map(items.map((item) => [item.id, item]));
export const personById = new Map(people.map((person) => [person.id, person]));
export const personBySlug = new Map(people.map((person) => [person.slug, person]));
export const clusterById = new Map<number, Cluster>(
  clusters.map((cluster) => [cluster.id, cluster]),
);

function sortByRankThenTitle(a: ProgramItem, b: ProgramItem) {
  const rankA = a.ranking?.rank || 9999;
  const rankB = b.ranking?.rank || 9999;
  if (rankA !== rankB) return rankA - rankB;
  return a.title.localeCompare(b.title);
}

function groupedBy<K, T>(rows: T[], keyFor: (row: T) => K | null | undefined) {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    if (key == null) continue;
    const group = map.get(key);
    if (group) group.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function clusterForItem(itemId: string): ItemClusterAssignment | undefined {
  return data.clusterByItem[itemId];
}

const TOPIC_DELTA = 0.07;
function buildTopicsForItem(itemId: string): { cluster: Cluster; score: number }[] {
  const assign = data.clusterByItem[itemId];
  if (!assign) return [];
  const ranked = [...assign.top].sort((a, b) => b.score - a.score);
  const primaryCluster = clusterById.get(assign.primary);
  const out: { cluster: Cluster; score: number }[] = [];
  if (primaryCluster) {
    const primaryScore =
      ranked.find((t) => t.clusterId === assign.primary)?.score ?? ranked[0]?.score ?? 0;
    out.push({ cluster: primaryCluster, score: primaryScore });
  }
  const topScore = ranked[0]?.score ?? 0;
  for (const entry of ranked) {
    if (entry.clusterId === assign.primary) continue;
    if (topScore - entry.score > TOPIC_DELTA) continue;
    const cluster = clusterById.get(entry.clusterId);
    if (cluster) out.push({ cluster, score: entry.score });
  }
  return out;
}

const topicsByItem = new Map(
  Object.keys(data.clusterByItem).map((itemId) => [itemId, buildTopicsForItem(itemId)]),
);

export function topicsForItem(itemId: string): { cluster: Cluster; score: number }[] {
  return topicsByItem.get(itemId)?.slice() || [];
}

const itemsByPrimaryCluster = groupedBy(items, (item) => data.clusterByItem[item.id]?.primary);

export function itemsInCluster(clusterId: number): ProgramItem[] {
  return itemsByPrimaryCluster.get(clusterId)?.slice() || [];
}

export const rankedItems = items
  .filter((item) => item.ranking)
  .sort((a, b) => (a.ranking?.rank || 9999) - (b.ranking?.rank || 9999));

const talksBySessionId = groupedBy(
  items.filter((item) => item.kind === "talk"),
  (item) => item.sessionId,
);
for (const talks of talksBySessionId.values()) {
  talks.sort((a, b) => (a.talkIndex ?? 0) - (b.talkIndex ?? 0));
}

const postersBySessionId = groupedBy(
  items.filter((item) => item.kind === "poster"),
  (item) => item.sessionId,
);
for (const posters of postersBySessionId.values()) {
  posters.sort((a, b) => (a.posterNum ?? 9999) - (b.posterNum ?? 9999) || a.title.localeCompare(b.title));
}

const relatedItemsById = new Map<string, { item: ProgramItem; score: number }[]>(
  Object.entries(data.related).map(([itemId, related]) => [
    itemId,
    related
      .map((entry) => ({ item: itemById.get(entry.id), score: entry.score }))
      .filter((entry): entry is { item: ProgramItem; score: number } => Boolean(entry.item)),
  ]),
);

const itemsByPersonSlug = new Map<string, ProgramItem[]>(
  people.map((person) => [
    person.slug,
    person.itemIds
      .map((id) => itemById.get(id))
      .filter((item): item is ProgramItem => Boolean(item))
      .sort(sortByRankThenTitle),
  ]),
);

const popularPeople = [...people].sort(
  (a, b) => b.itemIds.length - a.itemIds.length || a.name.localeCompare(b.name),
);

export function itemUrl(item: ProgramItem) {
  if (item.kind === "talk") return `/talk/${item.sourceId}`;
  if (item.kind === "poster") return `/poster/${item.sourceId}`;
  return `/session/${item.sourceId}`;
}

export function resolveItemFromPath(kind: string, id: string | undefined) {
  if (!id) return null;
  return itemById.get(`${kind}:${id}`) || null;
}

export function sessionTalks(sessionId: string) {
  return talksBySessionId.get(sessionId)?.slice() || [];
}

export function sessionPosters(sessionId: string) {
  return postersBySessionId.get(sessionId)?.slice() || [];
}

export function relatedItems(itemId: string) {
  return relatedItemsById.get(itemId)?.slice() || [];
}

export function peopleForItem(itemId: string) {
  return data.peopleByItem[itemId] || [];
}

export function itemsForPerson(personSlug: string) {
  return itemsByPersonSlug.get(personSlug)?.slice() || [];
}

export function relatedPeopleForPerson(personId: string) {
  return (data.relatedPeople[personId] || [])
    .map((related) => ({ person: personById.get(related.id), score: related.score, sharedItemCount: related.sharedItemCount }))
    .filter((entry): entry is { person: Person; score: number; sharedItemCount: number } => Boolean(entry.person));
}

const fuse = new Fuse(items, {
  keys: [
    { name: "title", weight: 3 },
    { name: "presenter", weight: 2 },
    { name: "authors", weight: 2 },
    { name: "abstract", weight: 1 },
    { name: "sessionTitle", weight: 1 },
    { name: "type", weight: 1 },
    { name: "room", weight: 1 },
  ],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 2,
});

const peopleFuse = new Fuse(people, {
  keys: [{ name: "name", weight: 3 }],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
});

export function searchPeople(query: string, limit = people.length) {
  const trimmed = query.trim();
  if (!trimmed) {
    return popularPeople.slice(0, limit);
  }
  return peopleFuse.search(trimmed, { limit }).map((result) => result.item);
}

export function searchItems(query: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed) {
    return rankedItems
      .slice(0, limit)
      .map((item) => ({ item, score: item.ranking?.score || 0 }));
  }
  return fuse
    .search(trimmed, { limit })
    .map((result) => ({
      item: result.item,
      // Fuse: 0 = perfect, 1 = no match. Flip so higher = better for our UI.
      score: 1 - (result.score ?? 1),
    }));
}
