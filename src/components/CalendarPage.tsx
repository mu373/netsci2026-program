import { MapPin } from "lucide-react";
import { useMemo } from "react";
import { items } from "../data";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  buildCalendarGridModel,
  posterCountsBySessionId,
  scheduledSessionsForDay,
} from "../lib/calendarGrid";
import { DAYS, openItem, parseSearch, pushUrl } from "../lib/navigation";
import { displayTitle, formatHour, sessionPeople, timeRange, titleCase } from "../lib/programHelpers";
import type { ProgramItem, SavedItem } from "../types";
import { SaveButton } from "./SaveButton";

function GridCell({
  session,
  posterCount,
  saved,
  onToggleSaved,
  gridRow,
  gridColumn,
  compact,
}: {
  session: ProgramItem;
  posterCount: number;
  saved: boolean;
  onToggleSaved: (id: string) => void;
  gridRow: string;
  gridColumn: string;
  compact: boolean;
}) {
  const isPoster = session.type === "poster" || /poster/i.test(session.title);
  const title = displayTitle(session);
  const compactDetail = (() => {
    if (!compact) return "";
    if (/invited talk/i.test(session.title)) return sessionPeople(session);
    if (session.type === "lightning" && session.chair) return `Chair: ${session.chair}`;
    return "";
  })();
  return (
    <button
      className={`cell ${compact ? "compact" : ""} ${compactDetail ? "withCompactSub" : ""} type-${session.type || "default"}`}
      style={{ gridRow, gridColumn }}
      onClick={() => openItem(session.id)}
      title={[title, timeRange(session), session.room, sessionPeople(session)].filter(Boolean).join(" · ")}
    >
      {!compact && <span className="cellType">{titleCase(session.type || "session")}</span>}
      <span className="cellTitle">{title}</span>
      {compactDetail && <span className="cellCompactSub">{compactDetail}</span>}
      {!compact && sessionPeople(session) && <span className="cellSub">{sessionPeople(session)}</span>}
      {!compact && (
        <span className="cellMeta">
          {session.room && (
            <span className="locationLabel">
              <MapPin size={11} aria-hidden="true" />
              {session.room}
            </span>
          )}
          {isPoster && posterCount > 0 && <span> · {posterCount} posters</span>}
        </span>
      )}
      <SaveButton itemId={session.id} saved={saved} onToggle={onToggleSaved} />
    </button>
  );
}

function MobileDayList({
  dayKey,
  savedById,
  savedOnly,
  onToggleSaved,
}: {
  dayKey: string;
  savedById: Map<string, SavedItem>;
  savedOnly: boolean;
  onToggleSaved: (id: string) => void;
}) {
  const sessions = useMemo(
    () =>
      items
        .filter((item) => item.kind === "session" && item.dayKey === dayKey)
        .filter((item) => (savedOnly ? savedById.has(item.id) : true))
        .sort((a, b) => (a.startH ?? 99) - (b.startH ?? 99) || (a.endH ?? 99) - (b.endH ?? 99)),
    [dayKey, savedById, savedOnly],
  );

  return (
    <div className="mobileDayList">
      {sessions.length === 0 && (
        <p className="muted" style={{ padding: "16px 4px" }}>
          No sessions{savedOnly ? " saved" : ""} for this day.
        </p>
      )}
      {sessions.map((session) => (
        <button
          key={session.id}
          className={`mobileSessionCard type-${session.type || "default"}`}
          onClick={() => openItem(session.id)}
        >
          <span className="mobileTime">{timeRange(session)}</span>
          <div className="mobileSessionTitle">{displayTitle(session)}</div>
          <div className="mobileSessionMeta">
            <span className="typePill">{titleCase(session.type || "session")}</span>
            {sessionPeople(session) && <span>{sessionPeople(session)}</span>}
            {session.room && (
              <span className="locationLabel">
                <MapPin size={12} aria-hidden="true" />
                {session.room}
              </span>
            )}
          </div>
          <span className="cardSave floating" onClick={(event) => event.stopPropagation()}>
            <SaveButton
              itemId={session.id}
              saved={savedById.has(session.id)}
              onToggle={onToggleSaved}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function DayGrid({
  dayKey,
  savedById,
  savedOnly,
  onToggleSaved,
}: {
  dayKey: string;
  savedById: Map<string, SavedItem>;
  savedOnly: boolean;
  onToggleSaved: (id: string) => void;
}) {
  const allSessions = useMemo(
    () => scheduledSessionsForDay(items, dayKey),
    [dayKey],
  );

  const filteredSessions = useMemo(
    () => allSessions.filter((session) => (savedOnly ? savedById.has(session.id) : true)),
    [allSessions, savedById, savedOnly],
  );

  const gridModel = useMemo(
    () => buildCalendarGridModel(dayKey, allSessions, filteredSessions),
    [allSessions, dayKey, filteredSessions],
  );

  const posterCounts = useMemo(() => posterCountsBySessionId(items), []);

  if (gridModel.boundaries.length < 2 || gridModel.dayRooms.length === 0) {
    return <div className="emptyRow">No sessions to display.</div>;
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: gridModel.gridTemplateColumns,
        gridTemplateRows: gridModel.gridTemplateRows,
      }}
    >
      <div className="gridHeadCell timeHead" style={{ gridRow: 1, gridColumn: 1 }} />
      {gridModel.roomHeaders.map(({ room, gridColumn }) => {
        return (
          <div
            className="gridHeadCell"
            key={room}
            style={{ gridRow: 1, gridColumn }}
          >
            {room}
          </div>
        );
      })}

      {gridModel.timeCells.map((cell) => {
        return (
          <div
            className={cell.isHour ? "timeCell hour" : "timeCell half"}
            key={cell.key}
            style={{ gridRow: cell.gridRow, gridColumn: 1 }}
          >
            {cell.isHour && <strong>{formatHour(cell.boundary)}</strong>}
            {cell.isHalf && <span>{formatHour(cell.boundary)}</span>}
          </div>
        );
      })}

      {gridModel.emptyCells.map((cell) => (
        <div
          className="emptyCell"
          key={cell.key}
          style={{
            gridRow: cell.gridRow,
            gridColumn: cell.gridColumn,
          }}
        />
      ))}

      {gridModel.positionedSessions.map(({ session, gridRow, gridColumn, compact }) => {
        return (
          <GridCell
            key={session.id}
            session={session}
            posterCount={posterCounts.get(session.sourceId) || 0}
            saved={savedById.has(session.id)}
            onToggleSaved={onToggleSaved}
            gridRow={gridRow}
            gridColumn={gridColumn}
            compact={compact}
          />
        );
      })}

      {gridModel.offRoomSessions.map(({ session, gridRow, gridColumn, compact }) => {
        return (
          <GridCell
            key={`off-${session.id}`}
            session={session}
            posterCount={posterCounts.get(session.sourceId) || 0}
            saved={savedById.has(session.id)}
            onToggleSaved={onToggleSaved}
            gridRow={gridRow}
            gridColumn={gridColumn}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

export function CalendarPage({
  dayKey,
  savedById,
  savedOnly,
  onToggleSaved,
}: {
  dayKey: string;
  savedById: Map<string, SavedItem>;
  savedOnly: boolean;
  onToggleSaved: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div className="calendarPane">
      <nav className="dayPills">
        {DAYS.map((day) => {
          const active = day.key === dayKey;
          return (
            <button
              key={day.key}
              className={active ? "dayPill active" : "dayPill"}
              onClick={() => {
                const search = parseSearch();
                search.delete("item");
                pushUrl(`/day/${day.key}`, search);
              }}
            >
              <strong>{day.abbr}</strong>
              <span>{day.date}</span>
            </button>
          );
        })}
      </nav>
      {isMobile ? (
        <MobileDayList
          dayKey={dayKey}
          savedById={savedById}
          savedOnly={savedOnly}
          onToggleSaved={onToggleSaved}
        />
      ) : (
        <DayGrid
          dayKey={dayKey}
          savedById={savedById}
          savedOnly={savedOnly}
          onToggleSaved={onToggleSaved}
        />
      )}
    </div>
  );
}
