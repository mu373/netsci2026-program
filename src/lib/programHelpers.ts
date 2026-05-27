import type { ProgramItem } from "../types";
import { parseSearch, updateParams } from "./navigation";

export type SortKey = "kind" | "title" | "presenter" | "day" | "time" | "room" | "score";
export type SortDir = "asc" | "desc";

export function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function displayTitle(item: ProgramItem) {
  const title = item.title.trim();
  if (title) return title;
  if (item.type) return titleCase(item.type);
  return titleCase(item.kind);
}

export function sessionPeople(session: ProgramItem) {
  const out: string[] = [];
  if (session.presenter) out.push(session.presenter);
  if (session.chair && session.chair !== session.presenter) out.push(`Chair: ${session.chair}`);
  return out.join(" · ");
}

export function itemSubLine(item: ProgramItem) {
  if (item.kind === "session") return sessionPeople(item);
  if (item.presenter) return item.presenter;
  return item.authors || "";
}

export function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeRange(item: ProgramItem): string {
  if (item.startH == null) return item.time || "";
  const start = formatHour(item.startH);
  if (item.endH == null) return start;
  return `${start}\u2013${formatHour(item.endH)}`;
}

export function sortItems(
  rows: { item: ProgramItem; score: number }[],
  sortKey: SortKey,
  sortDir: SortDir,
  dayOrderMap: Map<string, number>,
) {
  const dir = sortDir === "asc" ? 1 : -1;
  const cmp = (a: { item: ProgramItem; score: number }, b: { item: ProgramItem; score: number }) => {
    switch (sortKey) {
      case "kind":
        return a.item.kind.localeCompare(b.item.kind) * dir;
      case "title":
        return displayTitle(a.item).localeCompare(displayTitle(b.item)) * dir;
      case "presenter":
        return (a.item.presenter || "").localeCompare(b.item.presenter || "") * dir;
      case "day": {
        const da = dayOrderMap.get(a.item.dayKey) ?? 99;
        const db = dayOrderMap.get(b.item.dayKey) ?? 99;
        if (da !== db) return (da - db) * dir;
        return ((a.item.startH ?? 99) - (b.item.startH ?? 99)) * dir;
      }
      case "time":
        return ((a.item.startH ?? 99) - (b.item.startH ?? 99)) * dir;
      case "room":
        return (a.item.room || "").localeCompare(b.item.room || "") * dir;
      case "score":
        return (a.score - b.score) * dir;
    }
  };
  return [...rows].sort(cmp);
}

export function useTableSort(defaultKey: SortKey) {
  const params = parseSearch();
  const sortKey = (params.get("sort") || defaultKey) as SortKey;
  const sortDir = (params.get("dir") || (sortKey === "score" ? "desc" : "asc")) as SortDir;

  function onSortChange(key: SortKey) {
    updateParams((next) => {
      if (next.get("sort") === key || (!next.get("sort") && key === defaultKey)) {
        next.set("dir", sortDir === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", key);
        next.set("dir", key === "score" ? "desc" : "asc");
      }
    });
  }

  return { sortKey, sortDir, onSortChange };
}
