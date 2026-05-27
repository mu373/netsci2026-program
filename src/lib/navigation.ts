import { useEffect, useState } from "react";
import { data, itemById } from "../data";

export type Route =
  | { name: "calendar"; dayKey: string }
  | { name: "programs" }
  | { name: "people"; slug?: string }
  | { name: "chat" };

export const DAYS = data.days.all;
const DETAIL_RETURN_KEY = "netsci2026.detailReturn";

export function defaultDayKey() {
  return DAYS[0]?.key ?? "";
}

function parseRoute(): Route {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "people") return { name: "people", slug: parts[1] };
  if (parts[0] === "programs") return { name: "programs" };
  if (parts[0] === "chat") return { name: "chat" };

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
