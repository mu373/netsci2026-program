import { MapPin } from "lucide-react";
import { useMemo } from "react";
import { items } from "../data";
import { useIsMobile } from "../hooks/useIsMobile";
import { DAYS, openItem, parseSearch, pushUrl } from "../lib/navigation";
import { displayTitle, formatHour, sessionPeople, timeRange, titleCase } from "../lib/programHelpers";
import type { ProgramItem, SavedItem } from "../types";
import { SaveButton } from "./SaveButton";

const MAIN_HALL_TYPES = new Set(["plenary", "keynote", "lightning", "panel", "special"]);
const ROOM_ORDER = [
  "Amesbury Ballroom",
  "Inman Square",
  "Central Square",
  "Kendall Square",
  "Porter Square A",
  "Porter Square B",
  "Harvard Square A",
  "Harvard Square B",
];
const ROOM_ORDER_MAP = new Map(ROOM_ORDER.map((room, index) => [room, index]));

function sortRoomsForDay(dayKey: string, rooms: string[]) {
  return [...rooms].sort((a, b) => {
    if (dayKey === "tue") {
      if (a === "Fenway Park") return 1;
      if (b === "Fenway Park") return -1;
    }
    const ai = ROOM_ORDER_MAP.get(a);
    const bi = ROOM_ORDER_MAP.get(b);
    if (ai != null || bi != null) return (ai ?? 999) - (bi ?? 999);
    return a.localeCompare(b);
  });
}

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
    () =>
      items
        .filter(
          (item) =>
            item.kind === "session" &&
            item.dayKey === dayKey &&
            item.startH != null &&
            item.endH != null &&
            item.endH > item.startH,
        )
        .sort((a, b) => (a.startH ?? 99) - (b.startH ?? 99) || (a.endH ?? 99) - (b.endH ?? 99)),
    [dayKey],
  );

  const filteredSessions = allSessions.filter((session) => {
    if (savedOnly && !savedById.has(session.id)) return false;
    return true;
  });

  const dayRooms = useMemo(() => {
    const set = new Set<string>();
    for (const session of allSessions) if (session.room) set.add(session.room);
    return sortRoomsForDay(dayKey, [...set]);
  }, [allSessions, dayKey]);

  const boundaries = useMemo(() => {
    if (allSessions.length === 0) return [] as number[];
    let minH = Infinity;
    let maxH = -Infinity;
    for (const session of allSessions) {
      if (session.startH != null && session.startH < minH) minH = session.startH;
      if (session.endH != null && session.endH > maxH) maxH = session.endH;
    }
    const start = Math.floor(minH);
    const end = Math.ceil(maxH);
    const out: number[] = [];
    for (let q = 0; q <= (end - start) * 4; q++) {
      out.push(start + q * 0.25);
    }
    return out;
  }, [allSessions]);

  const boundIdx = useMemo(() => {
    const map = new Map<number, number>();
    boundaries.forEach((boundary, i) => map.set(boundary, i));
    return map;
  }, [boundaries]);

  const { laneByEvent, lanesByRoom } = useMemo(() => {
    const laneByEvent = new Map<string, number>();
    const lanesByRoom = new Map<string, number>();
    for (const room of dayRooms) {
      const roomEvents = filteredSessions
        .filter((session) => session.room === room)
        .sort((a, b) => (a.startH ?? 0) - (b.startH ?? 0));
      const laneEnds: number[] = [];
      for (const event of roomEvents) {
        let lane = laneEnds.findIndex((end) => end <= (event.startH ?? 0));
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(event.endH ?? 0);
        } else {
          laneEnds[lane] = event.endH ?? 0;
        }
        laneByEvent.set(event.id, lane);
      }
      const isMainHall = roomEvents.some((event) => MAIN_HALL_TYPES.has(event.type));
      lanesByRoom.set(room, Math.max(isMainHall ? 2 : 1, laneEnds.length));
    }
    return { laneByEvent, lanesByRoom };
  }, [dayRooms, filteredSessions]);

  const roomStartCol = useMemo(() => {
    const map = new Map<string, number>();
    let col = 2;
    for (const room of dayRooms) {
      map.set(room, col);
      col += lanesByRoom.get(room) ?? 1;
    }
    return map;
  }, [dayRooms, lanesByRoom]);

  const totalRoomCols = useMemo(
    () => dayRooms.reduce((sum, room) => sum + (lanesByRoom.get(room) ?? 1), 0),
    [dayRooms, lanesByRoom],
  );

  const rowPx = 26;
  const minLanePx = 130;
  const gridTemplateColumns = `78px ${dayRooms
    .map((room) => `repeat(${lanesByRoom.get(room) ?? 1}, minmax(${minLanePx}px, 1fr))`)
    .join(" ")}`;
  const gridTemplateRows = `30px repeat(${Math.max(boundaries.length - 1, 0)}, ${rowPx}px)`;

  const posterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.kind === "poster" && item.sessionId) {
        counts.set(item.sessionId, (counts.get(item.sessionId) || 0) + 1);
      }
    }
    return counts;
  }, []);

  const lowestLaneByBandRoom = new Map<string, number>();
  for (const session of filteredSessions) {
    const sb = boundIdx.get(session.startH!);
    const eb = boundIdx.get(session.endH!);
    if (sb == null || eb == null || !session.room || !dayRooms.includes(session.room)) continue;
    const lane = laneByEvent.get(session.id) ?? 0;
    for (let band = sb; band < eb; band++) {
      const key = `${band}|${session.room}`;
      const prev = lowestLaneByBandRoom.get(key);
      if (prev == null || lane < prev) lowestLaneByBandRoom.set(key, lane);
    }
  }

  const offRoomSessions = filteredSessions.filter(
    (session) => !session.room || !dayRooms.includes(session.room),
  );

  if (boundaries.length < 2 || dayRooms.length === 0) {
    return <div className="emptyRow">No sessions to display.</div>;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns, gridTemplateRows }}>
      <div className="gridHeadCell timeHead" style={{ gridRow: 1, gridColumn: 1 }} />
      {dayRooms.map((room) => {
        const startCol = roomStartCol.get(room)!;
        const span = lanesByRoom.get(room) ?? 1;
        return (
          <div
            className="gridHeadCell"
            key={room}
            style={{ gridRow: 1, gridColumn: `${startCol} / span ${span}` }}
          >
            {room}
          </div>
        );
      })}

      {boundaries.slice(0, -1).map((boundary, i) => {
        const isHour = Math.abs(boundary - Math.round(boundary)) < 1e-6;
        const isHalf = Math.abs(boundary * 2 - Math.round(boundary * 2)) < 1e-6 && !isHour;
        if (!isHour && !isHalf) return null;
        const span = isHour ? 4 : 2;
        const endIdx = Math.min(i + span, boundaries.length - 1);
        return (
          <div
            className={isHour ? "timeCell hour" : "timeCell half"}
            key={`t-${boundary}`}
            style={{ gridRow: `${i + 2} / ${endIdx + 2}`, gridColumn: 1 }}
          >
            {isHour && <strong>{formatHour(boundary)}</strong>}
            {isHalf && <span>{formatHour(boundary)}</span>}
          </div>
        );
      })}

      {boundaries.slice(0, -1).map((_, bandIdx) =>
        dayRooms.map((room) => {
          const baseCol = roomStartCol.get(room)!;
          const roomLanes = lanesByRoom.get(room) ?? 1;
          const lowest = lowestLaneByBandRoom.get(`${bandIdx}|${room}`);
          const hatchedTo = lowest == null ? roomLanes : lowest;
          if (hatchedTo <= 0) return null;
          return (
            <div
              className="emptyCell"
              key={`e-${bandIdx}-${room}`}
              style={{
                gridRow: bandIdx + 2,
                gridColumn: `${baseCol} / span ${hatchedTo}`,
              }}
            />
          );
        }),
      )}

      {filteredSessions
        .filter((session) => session.room && dayRooms.includes(session.room))
        .map((session) => {
          const sb = boundIdx.get(session.startH!)!;
          const eb = boundIdx.get(session.endH!)!;
          const baseCol = roomStartCol.get(session.room)!;
          const lane = laneByEvent.get(session.id) ?? 0;
          const roomLanes = lanesByRoom.get(session.room) ?? 1;
          return (
            <GridCell
              key={session.id}
              session={session}
              posterCount={posterCounts.get(session.sourceId) || 0}
              saved={savedById.has(session.id)}
              onToggleSaved={onToggleSaved}
              gridRow={`${sb + 2} / ${eb + 2}`}
              gridColumn={`${baseCol + lane} / span ${roomLanes - lane}`}
              compact={(eb - sb) <= 2}
            />
          );
        })}

      {offRoomSessions.map((session) => {
        const sb = boundIdx.get(session.startH!);
        const eb = boundIdx.get(session.endH!);
        if (sb == null || eb == null) return null;
        return (
          <GridCell
            key={`off-${session.id}`}
            session={session}
            posterCount={posterCounts.get(session.sourceId) || 0}
            saved={savedById.has(session.id)}
            onToggleSaved={onToggleSaved}
            gridRow={`${sb + 2} / ${eb + 2}`}
            gridColumn={`2 / span ${totalRoomCols}`}
            compact={(eb - sb) <= 2}
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
