import { CalendarPlus, ChevronDown, ChevronLeft, Download, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  itemById,
  items,
  peopleForItem,
  relatedItems,
  sessionTalks,
  topicsForItem,
} from "../data";
import { downloadItemIcs, eventTimes, openItemInGoogleCalendar } from "../lib/calendarExport";
import { closeItem, openItem, pushUrl } from "../lib/navigation";
import { displayTitle, itemSubLine, timeRange, titleCase } from "../lib/programHelpers";
import type { SavedItem } from "../types";
import { SaveButton } from "./SaveButton";

export function DetailDrawer({
  itemId,
  saved,
  savedRecord,
  onToggleSaved,
  onUpdateSaved,
  variant = "overlay",
}: {
  itemId: string;
  saved: boolean;
  savedRecord?: SavedItem;
  onToggleSaved: (id: string) => void;
  onUpdateSaved: (id: string, patch: Partial<SavedItem>) => void;
  variant?: "overlay" | "inline";
}) {
  const item = itemById.get(itemId);
  const drawerRef = useRef<HTMLElement | null>(null);
  const [navStack, setNavStack] = useState<string[]>([itemId]);
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeItem();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    drawerRef.current?.scrollTo({ top: 0 });
    setCalendarMenuOpen(false);
    setNavStack((prev) => {
      if (prev[prev.length - 1] === itemId) return prev;
      return [...prev, itemId];
    });
  }, [itemId]);

  const canGoBack = navStack.length >= 2;

  function goBack() {
    if (!canGoBack) return;
    const next = navStack.slice(0, -1);
    setNavStack(next);
    const prevId = next[next.length - 1];
    const params = new URLSearchParams(location.search);
    params.set("item", prevId);
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  const linkedPeople = item ? peopleForItem(item.id) : [];
  const orderedPeople = useMemo(() => {
    if (!item?.authors) return linkedPeople;
    const orderMap = new Map<string, number>();
    item.authors.split(";").forEach((part, idx) => {
      const trimmed = part.trim().replace(/\*$/, "");
      const comma = trimmed.indexOf(",");
      if (comma === -1) return;
      const last = trimmed.slice(0, comma).trim();
      const first = trimmed.slice(comma + 1).replace("*", "").trim();
      if (!first || !last) return;
      orderMap.set(`${first} ${last}`.toLocaleLowerCase(), idx);
    });
    return [...linkedPeople].sort((a, b) => {
      const ai = orderMap.get(a.name.toLocaleLowerCase()) ?? Infinity;
      const bi = orderMap.get(b.name.toLocaleLowerCase()) ?? Infinity;
      return ai - bi;
    });
  }, [item?.authors, linkedPeople]);

  if (!item) return null;

  const talks = item.kind === "session" ? sessionTalks(item.sourceId) : [];
  const posters =
    item.kind === "session"
      ? items.filter((other) => other.kind === "poster" && other.sessionId === item.sourceId)
      : [];
  const related = relatedItems(item.id).slice(0, 10);
  const sessionChair =
    item.kind === "session" && item.chair ? item.chair.replace(/\s*;\s*/g, ", ") : "";

  return (
    <>
      {variant === "overlay" && <div className="drawerBackdrop" onClick={closeItem} />}
      <aside
        ref={drawerRef}
        className={variant === "inline" ? "drawer inline" : "drawer"}
        role="dialog"
        aria-label="Item detail"
      >
        <nav className="drawerNav">
          {canGoBack ? (
            <button className="iconBtn" onClick={goBack} title="Back" aria-label="Back">
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span />
          )}
          <button className="iconBtn" onClick={closeItem} title="Close (Esc)" aria-label="Close">
            <X size={18} />
          </button>
        </nav>

        <div className="drawerTags">
          <span className={`kindTag k-${item.kind}`}>{titleCase(item.kind)}</span>
          {item.type && <span className="typeTag">{titleCase(item.type)}</span>}
        </div>
        <h1 className="drawerTitle">{displayTitle(item)}</h1>
        <p className="drawerMeta">
          {[item.dayLabel, timeRange(item), item.room, item.posterNum ? `Poster ${item.posterNum}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {sessionChair && (
          <p className="drawerDescription">
            <strong>Chair:</strong> {sessionChair}
          </p>
        )}
        <div className="drawerActions">
          {eventTimes(item) && (
            <div className="calendarMenu">
              <button
                className="drawerLink calendarMenuButton"
                onClick={() => setCalendarMenuOpen((open) => !open)}
                title="Add this event to a calendar"
                aria-haspopup="menu"
                aria-expanded={calendarMenuOpen}
              >
                <CalendarPlus size={13} /> Add to Calendar <ChevronDown size={12} />
              </button>
              {calendarMenuOpen && (
                <div className="calendarMenuList" role="menu">
                  <button
                    className="calendarMenuItem"
                    role="menuitem"
                    onClick={() => {
                      openItemInGoogleCalendar(item, savedRecord?.note);
                      setCalendarMenuOpen(false);
                    }}
                  >
                    <ExternalLink size={13} /> Open in Google Calendar
                  </button>
                  <button
                    className="calendarMenuItem"
                    role="menuitem"
                    onClick={() => {
                      downloadItemIcs(item, savedRecord?.note);
                      setCalendarMenuOpen(false);
                    }}
                  >
                    <Download size={13} /> Download .ics
                  </button>
                </div>
              )}
            </div>
          )}
          {item.url && (
            <a className="drawerLink" href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Website
            </a>
          )}
        </div>

        <div className="drawerSection saveSection">
          <div className="saveRow">
            <SaveButton itemId={item.id} saved={saved} onToggle={onToggleSaved} size={14} />
            {saved ? (
              <select
                value={savedRecord?.status || "interested"}
                onChange={(event) =>
                  onUpdateSaved(item.id, { status: event.target.value as SavedItem["status"] })
                }
              >
                <option value="interested">Interested</option>
                <option value="must-see">Must-see</option>
                <option value="maybe">Maybe</option>
                <option value="attended">Attended</option>
              </select>
            ) : (
              <span className="muted">Save to add notes</span>
            )}
          </div>
          {saved && (
            <textarea
              className="noteBox"
              placeholder="Private note"
              value={savedRecord?.note || ""}
              onChange={(event) => onUpdateSaved(item.id, { note: event.target.value })}
            />
          )}
        </div>

        {linkedPeople.length > 0 && (
          <div className="drawerSection">
            <h3>People</h3>
            <div className="peopleChips">
              {orderedPeople.slice(0, 20).map((person) => (
                <a
                  key={`${person.id}-${person.roles.join("-")}`}
                  className="chip"
                  href={`/people/${person.slug}`}
                  onClick={(event) => {
                    event.preventDefault();
                    pushUrl(`/people/${person.slug}`);
                  }}
                >
                  {person.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const topics = topicsForItem(item.id);
          if (topics.length === 0) return null;
          return (
            <div className="drawerSection">
              <h3>{topics.length > 1 ? "Topics" : "Topic"}</h3>
              <div className="peopleChips">
                {topics.map(({ cluster }) => (
                  <a
                    key={cluster.id}
                    className="chip"
                    href={`/programs?view=topics&cluster=${cluster.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      const search = new URLSearchParams();
                      search.set("view", "topics");
                      search.set("cluster", String(cluster.id));
                      pushUrl("/programs", search);
                    }}
                    title={cluster.description}
                  >
                    {cluster.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {item.abstract && (
          <div className="drawerSection">
            <h3>Abstract</h3>
            <p className="abstractText">{item.abstract}</p>
          </div>
        )}

        {talks.length > 0 && (
          <div className="drawerSection">
            <h3>Talks ({talks.length})</h3>
            <div className="innerList">
              {talks.map((talk) => (
                <button className="innerRow talkRow" key={talk.id} onClick={() => openItem(talk.id)}>
                  <span className="innerMain">
                    <span className="talkTitleLine">
                      <span className="kindTag k-talk mini">Talk</span>
                      <strong>{talk.title}</strong>
                    </span>
                    <span>{talk.presenter}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {posters.length > 0 && (
          <div className="drawerSection">
            <h3>Posters ({posters.length})</h3>
            <div className="innerList">
              {posters.slice(0, 40).map((poster) => (
                <button className="innerRow" key={poster.id} onClick={() => openItem(poster.id)}>
                  <span className="innerIdx">P{poster.posterNum ?? ""}</span>
                  <span className="innerMain">
                    <strong>{poster.title}</strong>
                    <span>{poster.presenter}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="drawerSection">
            <h3>Related</h3>
            <div className="innerList">
              {related.map(({ item: rel, score }) => (
                <button
                  className="innerRow relatedRow"
                  key={rel.id}
                  onClick={() => openItem(rel.id)}
                >
                  <span className="innerMain">
                    <span className="relTitleLine">
                      <span className={`kindTag k-${rel.kind} mini`}>{titleCase(rel.kind)}</span>
                      <strong>{rel.title}</strong>
                    </span>
                    {itemSubLine(rel) && <span className="relSub">{itemSubLine(rel)}</span>}
                  </span>
                  <span className="relScore">{score.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
