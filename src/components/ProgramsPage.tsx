import { Bookmark, ChevronLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clusterById,
  clusterForItem,
  clusters,
  items,
  searchItems,
} from "../data";
import { DAYS, openItem, parseSearch, scrollPageToTop, updateParams } from "../lib/navigation";
import { sortItems, useTableSort } from "../lib/programHelpers";
import type { SavedItem } from "../types";
import { ItemsTable } from "./ItemsTable";

const TOPICS_LIST_SCROLL_KEY = "netsci2026.topicsListScrollY";

function saveTopicsListScroll() {
  const scroller = document.scrollingElement || document.documentElement;
  sessionStorage.setItem(TOPICS_LIST_SCROLL_KEY, String(scroller.scrollTop));
}

function clearTopicsListScroll() {
  sessionStorage.removeItem(TOPICS_LIST_SCROLL_KEY);
}

function restoreTopicsListScroll() {
  const raw = sessionStorage.getItem(TOPICS_LIST_SCROLL_KEY);
  if (!raw) return false;
  const top = Number(raw);
  if (!Number.isFinite(top)) return false;
  requestAnimationFrame(() => {
    const scroller = document.scrollingElement || document.documentElement;
    scroller.scrollTo({ top, left: 0 });
  });
  return true;
}

export function ProgramsPage({
  savedById,
  onToggleSaved,
}: {
  savedById: Map<string, SavedItem>;
  onToggleSaved: (id: string) => void;
}) {
  const params = parseSearch();
  const query = params.get("q") || "";
  const kindFilter = params.get("kind") || "all";
  const dayFilter = params.get("day") || "all";
  const savedOnly = params.get("saved") === "1";
  const view = params.get("view") === "topics" ? "topics" : "list";
  const clusterParam = params.get("cluster");
  const clusterId =
    clusterParam != null && Number.isFinite(Number(clusterParam)) ? Number(clusterParam) : null;

  const { sortKey, sortDir, onSortChange } = useTableSort(query ? "score" : "day");

  function setParam(key: string, value: string | null) {
    updateParams((next) => {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
    });
  }

  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (searchInput === query) return;
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(location.search);
      if (searchInput) next.set("q", searchInput);
      else next.delete("q");
      next.delete("sort");
      next.delete("dir");
      const search = next.toString() ? `?${next.toString()}` : "";
      history.replaceState(null, "", `${location.pathname}${search}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 180);
    return () => clearTimeout(timeout);
  }, [searchInput, query]);

  const dayOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    DAYS.forEach((day, i) => map.set(day.key, i));
    return map;
  }, []);

  const results = useMemo(() => {
    const base = query.trim()
      ? searchItems(query, 5000)
      : items.map((item) => ({ item, score: item.ranking?.score || 0 }));
    const filtered = base.filter(({ item }) => {
      if (savedOnly && !savedById.has(item.id)) return false;
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (dayFilter !== "all" && item.dayKey !== dayFilter) return false;
      if (clusterId != null && clusterForItem(item.id)?.primary !== clusterId) return false;
      return true;
    });
    return sortItems(filtered, sortKey, sortDir, dayOrderMap);
  }, [clusterId, dayFilter, dayOrderMap, kindFilter, query, savedById, savedOnly, sortDir, sortKey]);

  const openItemId = params.get("item");

  useEffect(() => {
    if (!openItemId) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown" &&
        event.key !== "j" &&
        event.key !== "k"
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const idx = results.findIndex(({ item }) => item.id === openItemId);
      if (idx < 0) return;
      const dir = event.key === "ArrowDown" || event.key === "j" ? 1 : -1;
      const next = idx + dir;
      if (next < 0 || next >= results.length) return;
      event.preventDefault();
      openItem(results[next].item.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openItemId, results]);

  useEffect(() => {
    if (view !== "topics") {
      scrollPageToTop();
      return;
    }
    if (clusterId == null) {
      if (!restoreTopicsListScroll()) scrollPageToTop();
    } else {
      scrollPageToTop();
    }
  }, [clusterId, view]);

  const activeCluster = clusterId != null ? clusterById.get(clusterId) : null;

  return (
    <div className="programsPane">
      <div className="viewSwitch">
        <button
          className={view === "list" ? "kindBtn active" : "kindBtn"}
          onClick={() => {
            updateParams((next) => {
              next.delete("view");
              next.delete("cluster");
            });
          }}
        >
          List
        </button>
        <button
          className={view === "topics" ? "kindBtn active" : "kindBtn"}
          onClick={() => {
            clearTopicsListScroll();
            updateParams((next) => {
              next.set("view", "topics");
              next.delete("cluster");
            });
            scrollPageToTop();
          }}
        >
          Topics
        </button>
      </div>

      {view === "topics" && (
        <p className="topicsNote">
          Topics are generated from clusters of program-item embeddings and are discovery aids, not
          official conference tracks.
        </p>
      )}

      {view === "topics" && clusterId == null ? (
        <>
          <div className="filterBar">
            <label className="searchBox grow">
              <Search size={14} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search topics…"
              />
              {searchInput && (
                <button className="iconBtn" onClick={() => setSearchInput("")} title="Clear">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          {(() => {
            const needle = query.trim().toLocaleLowerCase();
            const filtered = needle
              ? clusters.filter(
                  (cluster) =>
                    cluster.label.toLocaleLowerCase().includes(needle) ||
                    cluster.description.toLocaleLowerCase().includes(needle),
                )
              : clusters;
            if (filtered.length === 0) {
              return <p className="muted">No topics match "{query}".</p>;
            }
            return (
              <div className="topicsGrid">
                {filtered.map((cluster) => (
                  <button
                    key={cluster.id}
                    className="topicCard"
                    onClick={() => {
                      saveTopicsListScroll();
                      updateParams((next) => {
                        next.set("view", "topics");
                        next.set("cluster", String(cluster.id));
                        next.delete("q");
                      });
                    }}
                  >
                    <div className="topicCardHead">
                      <strong>{cluster.label}</strong>
                      <span>{cluster.size}</span>
                    </div>
                    <p>{cluster.description}</p>
                  </button>
                ))}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {activeCluster && (
            <div className="topicHeader">
              <button
                className="backBtn"
                onClick={() =>
                  updateParams((next) => {
                    next.set("view", "topics");
                    next.delete("cluster");
                  })
                }
              >
                <ChevronLeft size={14} /> Topics
              </button>
              <div>
                <h2 style={{ margin: 0 }}>{activeCluster.label}</h2>
                <p className="muted" style={{ margin: "2px 0 0" }}>
                  {activeCluster.description}
                </p>
              </div>
            </div>
          )}

          <div className="filterBar">
            <div className="kindGroup">
              {[
                ["all", "All"],
                ["session", "Sessions"],
                ["talk", "Talks"],
                ["poster", "Posters"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={kindFilter === value ? "kindBtn active" : "kindBtn"}
                  onClick={() => setParam("kind", value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              className="daySelect"
              value={dayFilter}
              onChange={(event) => setParam("day", event.target.value)}
            >
              <option value="all">All days</option>
              {DAYS.map((day) => (
                <option key={day.key} value={day.key}>
                  {day.abbr} {day.date}
                </option>
              ))}
            </select>

            <label className="searchBox grow">
              <Search size={14} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title, abstract, presenter, room…"
              />
              {searchInput && (
                <button className="iconBtn" onClick={() => setSearchInput("")} title="Clear">
                  <X size={14} />
                </button>
              )}
            </label>

            <label className={savedOnly ? "savedToggle on" : "savedToggle"}>
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(event) => setParam("saved", event.target.checked ? "1" : null)}
              />
              <Bookmark size={13} /> Saved
            </label>

            <span className="resultsCount">{results.length} Items</span>
          </div>

          <ItemsTable
            rows={results}
            showScore={!!query}
            savedById={savedById}
            onToggleSaved={onToggleSaved}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={onSortChange}
            activeItemId={openItemId}
          />
        </>
      )}
    </div>
  );
}
