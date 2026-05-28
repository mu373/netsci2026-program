import { useEffect, useState } from "react";
import { data, itemById } from "../data";

export type Route =
  | { name: "calendar"; dayKey: string }
  | { name: "programs" }
  | { name: "people"; slug?: string }
  | { name: "chat" }
  | { name: "docs" };

export const DAYS = data.days.all;
const DETAIL_RETURN_KEY = "netsci2026.detailReturn";
const CONFERENCE_YEAR = 2026;
const CONFERENCE_TIME_ZONE = "America/New_York";
const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function bostonDateParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONFERENCE_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function dayDateParts(date: string) {
  const match = date.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLocaleLowerCase()];
  const day = Number(match[2]);
  if (!month || !Number.isFinite(day)) return null;
  return { month, day };
}

export function defaultDayKey() {
  const today = bostonDateParts();
  if (today.year === CONFERENCE_YEAR) {
    const currentDay = DAYS.find((day) => {
      const date = dayDateParts(day.date);
      return date?.month === today.month && date.day === today.day;
    });
    if (currentDay) return currentDay.key;
  }

  return DAYS[0]?.key ?? "";
}

function parseRoute(): Route {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "people") return { name: "people", slug: parts[1] };
  if (parts[0] === "programs") return { name: "programs" };
  if (parts[0] === "chat") return { name: "chat" };
  if (parts[0] === "docs" || (parts[0] === "api" && parts[1] === "docs")) {
    return { name: "docs" };
  }

  // Legacy topics URLs -> redirect into Programs.
  if (parts[0] === "topics") {
    const id = parts[1];
    const next = new URLSearchParams();
    next.set("view", "topics");
    if (id) next.set("cluster", id);
    history.replaceState(null, "", `/programs?${next.toString()}`);
    return { name: "programs" };
  }

  if (parts[0] === "day" && parts[1]) {
    const known = DAYS.find((day) => day.key === parts[1]);
    if (known) return { name: "calendar", dayKey: known.key };
  }

  if (parts[0] === "calendar") {
    const key = parts[1] && DAYS.find((day) => day.key === parts[1])?.key;
    return { name: "calendar", dayKey: key || defaultDayKey() };
  }

  // Legacy item URLs redirect with drawer open.
  if (["talk", "poster", "session"].includes(parts[0]) && parts[1]) {
    const item = itemById.get(`${parts[0]}:${parts[1]}`);
    if (item) {
      const dayKey = item.dayKey || defaultDayKey();
      history.replaceState(null, "", `/day/${dayKey}?item=${item.id}`);
      return { name: "calendar", dayKey };
    }
  }

  return { name: "calendar", dayKey: defaultDayKey() };
}

export function parseSearch(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function pushUrl(path: string, params?: URLSearchParams) {
  const search = params && [...params.keys()].length ? `?${params.toString()}` : "";
  history.pushState(null, "", `${path}${search}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function updateParams(mutate: (params: URLSearchParams) => void) {
  const params = parseSearch();
  mutate(params);
  pushUrl(location.pathname, params);
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  const [params, setParams] = useState(parseSearch);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute());
      setParams(parseSearch());
    };
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return { route, params };
}

export function openItem(itemId: string) {
  updateParams((params) => params.set("item", itemId));
}

export function closeItem() {
  const params = parseSearch();
  const item = params.get("item");
  const returnTarget = params.get("returnTo") || (item ? sessionStorage.getItem(DETAIL_RETURN_KEY) : null);
  if (returnTarget === "chat") {
    sessionStorage.removeItem(DETAIL_RETURN_KEY);
    pushUrl("/chat");
    return;
  }
  sessionStorage.removeItem(DETAIL_RETURN_KEY);
  updateParams((nextParams) => {
    nextParams.delete("item");
    nextParams.delete("returnTo");
  });
}

export function rememberDetailReturn(target: "chat") {
  sessionStorage.setItem(DETAIL_RETURN_KEY, target);
}

export function scrollPageToTop() {
  const scroller = document.scrollingElement || document.documentElement;
  scroller.scrollTo({ top: 0, left: 0 });
}
