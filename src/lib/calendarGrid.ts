import type { ProgramItem } from "../types";

export type ScheduledSession = ProgramItem & {
  startH: number;
  endH: number;
};

export type TimeCellLayout = {
  key: string;
  boundary: number;
  isHour: boolean;
  isHalf: boolean;
  gridRow: string;
};

export type EmptyCellLayout = {
  key: string;
  gridRow: number;
  gridColumn: string;
};

export type RoomHeaderLayout = {
  room: string;
  gridColumn: string;
};

export type PositionedSession = {
  session: ScheduledSession;
  gridRow: string;
  gridColumn: string;
  compact: boolean;
};

export type CalendarGridModel = {
  dayRooms: string[];
  boundaries: number[];
  gridTemplateColumns: string;
  gridTemplateRows: string;
  roomHeaders: RoomHeaderLayout[];
  timeCells: TimeCellLayout[];
  emptyCells: EmptyCellLayout[];
  positionedSessions: PositionedSession[];
  offRoomSessions: PositionedSession[];
};

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
const ROW_PX = 26;
const MIN_LANE_PX = 130;

export function sortRoomsForDay(dayKey: string, rooms: string[]) {
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

export function scheduledSessionsForDay(items: ProgramItem[], dayKey: string): ScheduledSession[] {
  return items
    .filter(
      (item): item is ScheduledSession =>
        item.kind === "session" &&
        item.dayKey === dayKey &&
        item.startH != null &&
        item.endH != null &&
        item.endH > item.startH,
    )
    .sort((a, b) => a.startH - b.startH || a.endH - b.endH);
}

export function posterCountsBySessionId(items: ProgramItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === "poster" && item.sessionId) {
      counts.set(item.sessionId, (counts.get(item.sessionId) || 0) + 1);
    }
  }
  return counts;
}

function boundariesForSessions(sessions: ScheduledSession[]) {
  if (sessions.length === 0) return [] as number[];

  let minH = Infinity;
  let maxH = -Infinity;
  for (const session of sessions) {
    if (session.startH < minH) minH = session.startH;
    if (session.endH > maxH) maxH = session.endH;
  }

  const start = Math.floor(minH);
  const end = Math.ceil(maxH);
  const out: number[] = [];
  for (let q = 0; q <= (end - start) * 4; q++) {
    out.push(start + q * 0.25);
  }
  return out;
}

function boundaryIndex(boundaries: number[]) {
  const map = new Map<number, number>();
  boundaries.forEach((boundary, i) => map.set(boundary, i));
  return map;
}

function roomLanes(dayRooms: string[], sessions: ScheduledSession[]) {
  const laneByEvent = new Map<string, number>();
  const lanesByRoom = new Map<string, number>();

  for (const room of dayRooms) {
    const roomEvents = sessions
      .filter((session) => session.room === room)
      .sort((a, b) => a.startH - b.startH);
    const laneEnds: number[] = [];

    for (const event of roomEvents) {
      let lane = laneEnds.findIndex((end) => end <= event.startH);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(event.endH);
      } else {
        laneEnds[lane] = event.endH;
      }
      laneByEvent.set(event.id, lane);
    }

    const isMainHall = roomEvents.some((event) => MAIN_HALL_TYPES.has(event.type));
    lanesByRoom.set(room, Math.max(isMainHall ? 2 : 1, laneEnds.length));
  }

  return { laneByEvent, lanesByRoom };
}

function roomStartColumns(dayRooms: string[], lanesByRoom: Map<string, number>) {
  const map = new Map<string, number>();
  let col = 2;
  for (const room of dayRooms) {
    map.set(room, col);
    col += lanesByRoom.get(room) ?? 1;
  }
  return map;
}

function timeCellsForBoundaries(boundaries: number[]) {
  return boundaries.slice(0, -1).flatMap((boundary, i) => {
    const isHour = Math.abs(boundary - Math.round(boundary)) < 1e-6;
    const isHalf = Math.abs(boundary * 2 - Math.round(boundary * 2)) < 1e-6 && !isHour;
    if (!isHour && !isHalf) return [];
    const span = isHour ? 4 : 2;
    const endIdx = Math.min(i + span, boundaries.length - 1);
    return [
      {
        key: `t-${boundary}`,
        boundary,
        isHour,
        isHalf,
        gridRow: `${i + 2} / ${endIdx + 2}`,
      },
    ];
  });
}

function roomHeadersForRooms(
  dayRooms: string[],
  roomStartCol: Map<string, number>,
  lanesByRoom: Map<string, number>,
) {
  return dayRooms.flatMap((room) => {
    const startCol = roomStartCol.get(room);
    if (startCol == null) return [];
    return [
      {
        room,
        gridColumn: `${startCol} / span ${lanesByRoom.get(room) ?? 1}`,
      },
    ];
  });
}

function lowestLaneByBandRoom(
  sessions: ScheduledSession[],
  dayRooms: string[],
  boundIdx: Map<number, number>,
  laneByEvent: Map<string, number>,
) {
  const lowest = new Map<string, number>();
  for (const session of sessions) {
    const sb = boundIdx.get(session.startH);
    const eb = boundIdx.get(session.endH);
    if (sb == null || eb == null || !session.room || !dayRooms.includes(session.room)) continue;
    const lane = laneByEvent.get(session.id) ?? 0;
    for (let band = sb; band < eb; band++) {
      const key = `${band}|${session.room}`;
      const prev = lowest.get(key);
      if (prev == null || lane < prev) lowest.set(key, lane);
    }
  }
  return lowest;
}

function emptyCellsForRooms(
  boundaries: number[],
  dayRooms: string[],
  roomStartCol: Map<string, number>,
  lanesByRoom: Map<string, number>,
  lowestLane: Map<string, number>,
) {
  return boundaries.slice(0, -1).flatMap((_, bandIdx) =>
    dayRooms.flatMap((room) => {
      const baseCol = roomStartCol.get(room);
      if (baseCol == null) return [];
      const roomLanes = lanesByRoom.get(room) ?? 1;
      const lowest = lowestLane.get(`${bandIdx}|${room}`);
      const hatchedTo = lowest == null ? roomLanes : lowest;
      if (hatchedTo <= 0) return [];
      return [
        {
          key: `e-${bandIdx}-${room}`,
          gridRow: bandIdx + 2,
          gridColumn: `${baseCol} / span ${hatchedTo}`,
        },
      ];
    }),
  );
}

function positionedSessionsForRooms(
  sessions: ScheduledSession[],
  dayRooms: string[],
  boundIdx: Map<number, number>,
  roomStartCol: Map<string, number>,
  lanesByRoom: Map<string, number>,
  laneByEvent: Map<string, number>,
) {
  return sessions.flatMap((session) => {
    if (!session.room || !dayRooms.includes(session.room)) return [];

    const sb = boundIdx.get(session.startH);
    const eb = boundIdx.get(session.endH);
    const baseCol = roomStartCol.get(session.room);
    if (sb == null || eb == null || baseCol == null) return [];

    const lane = laneByEvent.get(session.id) ?? 0;
    const roomLanes = lanesByRoom.get(session.room) ?? 1;
    return [
      {
        session,
        gridRow: `${sb + 2} / ${eb + 2}`,
        gridColumn: `${baseCol + lane} / span ${roomLanes - lane}`,
        compact: eb - sb <= 2,
      },
    ];
  });
}

function positionedOffRoomSessions(
  sessions: ScheduledSession[],
  dayRooms: string[],
  boundIdx: Map<number, number>,
  totalRoomCols: number,
) {
  return sessions.flatMap((session) => {
    if (session.room && dayRooms.includes(session.room)) return [];

    const sb = boundIdx.get(session.startH);
    const eb = boundIdx.get(session.endH);
    if (sb == null || eb == null) return [];

    return [
      {
        session,
        gridRow: `${sb + 2} / ${eb + 2}`,
        gridColumn: `2 / span ${totalRoomCols}`,
        compact: eb - sb <= 2,
      },
    ];
  });
}

export function buildCalendarGridModel(
  dayKey: string,
  allSessions: ScheduledSession[],
  filteredSessions: ScheduledSession[],
): CalendarGridModel {
  const dayRooms = sortRoomsForDay(
    dayKey,
    [...new Set(allSessions.map((session) => session.room).filter(Boolean))],
  );
  const boundaries = boundariesForSessions(allSessions);
  const boundIdx = boundaryIndex(boundaries);
  const { laneByEvent, lanesByRoom } = roomLanes(dayRooms, filteredSessions);
  const roomStartCol = roomStartColumns(dayRooms, lanesByRoom);
  const totalRoomCols = dayRooms.reduce((sum, room) => sum + (lanesByRoom.get(room) ?? 1), 0);
  const lowestLane = lowestLaneByBandRoom(filteredSessions, dayRooms, boundIdx, laneByEvent);

  return {
    dayRooms,
    boundaries,
    gridTemplateColumns: `78px ${dayRooms
      .map((room) => `repeat(${lanesByRoom.get(room) ?? 1}, minmax(${MIN_LANE_PX}px, 1fr))`)
      .join(" ")}`,
    gridTemplateRows: `30px repeat(${Math.max(boundaries.length - 1, 0)}, ${ROW_PX}px)`,
    roomHeaders: roomHeadersForRooms(dayRooms, roomStartCol, lanesByRoom),
    timeCells: timeCellsForBoundaries(boundaries),
    emptyCells: emptyCellsForRooms(boundaries, dayRooms, roomStartCol, lanesByRoom, lowestLane),
    positionedSessions: positionedSessionsForRooms(
      filteredSessions,
      dayRooms,
      boundIdx,
      roomStartCol,
      lanesByRoom,
      laneByEvent,
    ),
    offRoomSessions: positionedOffRoomSessions(filteredSessions, dayRooms, boundIdx, totalRoomCols),
  };
}
