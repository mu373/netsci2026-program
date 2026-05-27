import Fuse from "fuse.js";
import rawData from "./data/program-data.json";
import type { AppData, Cluster, ItemClusterAssignment, Person, ProgramItem } from "./types";

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

export function clusterForItem(itemId: string): ItemClusterAssignment | undefined {
  return data.clusterByItem[itemId];
}

const TOPIC_DELTA = 0.07;
export function topicsForItem(itemId: string): { cluster: Cluster; score: number }[] {
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

export function itemsInCluster(clusterId: number): ProgramItem[] {
  return items.filter((item) => data.clusterByItem[item.id]?.primary === clusterId);
}

export const rankedItems = items
  .filter((item) => item.ranking)
  .sort((a, b) => (a.ranking?.rank || 9999) - (b.ranking?.rank || 9999));

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
  return items
    .filter((item) => item.kind === "talk" && item.sessionId === sessionId)
    .sort((a, b) => (a.talkIndex ?? 0) - (b.talkIndex ?? 0));
}

export function relatedItems(itemId: string) {
  return (data.related[itemId] || [])
    .map((related) => ({ item: itemById.get(related.id), score: related.score }))
    .filter((entry): entry is { item: ProgramItem; score: number } => Boolean(entry.item));
}

export function peopleForItem(itemId: string) {
  return data.peopleByItem[itemId] || [];
}

export function itemsForPerson(personSlug: string) {
  const person = personBySlug.get(personSlug);
  if (!person) return [];
  return person.itemIds
    .map((id) => itemById.get(id))
    .filter((item): item is ProgramItem => Boolean(item))
    .sort((a, b) => {
      const rankA = a.ranking?.rank || 9999;
      const rankB = b.ranking?.rank || 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.title.localeCompare(b.title);
    });
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
    return [...people].sort((a, b) => b.itemIds.length - a.itemIds.length).slice(0, limit);
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
