import { items } from "../data";
import { displayTitle } from "./programHelpers";
import type { ProgramItem } from "../types";

// Conference is June 1-5, 2026 in Boston (Mon-Fri).
const DAY_DATE: Record<string, string> = {
  mon: "20260601",
  tue: "20260602",
  wed: "20260603",
  thu: "20260604",
  fri: "20260605",
};

function hourToHHMMSS(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, "0")}${String(min).padStart(2, "0")}00`;
}

export function eventTimes(item: ProgramItem): { date: string; start: string; end: string } | null {
  let dayKey = item.dayKey;
  let startH = item.startH;
  let endH = item.endH;
  if ((startH == null || endH == null) && item.sessionId) {
    const parent = items.find((other) => other.kind === "session" && other.sourceId === item.sessionId);
    if (parent) {
      dayKey = dayKey || parent.dayKey;
      startH = startH ?? parent.startH;
      endH = endH ?? parent.endH;
    }
  }
  const date = DAY_DATE[dayKey];
  if (!date || startH == null || endH == null) return null;
  return { date, start: hourToHHMMSS(startH), end: hourToHHMMSS(endH) };
}

function escapeICalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldICalLine(line: string): string {
  // RFC 5545: lines should be at most 75 octets; longer lines fold with CRLF + space.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    parts.push((i === 0 ? "" : " ") + chunk);
    i += chunk.length;
  }
  return parts.join("\r\n");
}

function buildICalForItem(item: ProgramItem, note?: string): string | null {
  const times = eventTimes(item);
  if (!times) return null;

  const now = new Date();
  const dtstamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    "T" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0") +
    "Z";

  const desc = calendarDescription(item, note);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NetSci 2026 Unofficial Guide//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldICalLine(`UID:${item.id}@netsci2026`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/New_York:${times.date}T${times.start}`,
    `DTEND;TZID=America/New_York:${times.date}T${times.end}`,
    foldICalLine(`SUMMARY:${escapeICalText(displayTitle(item))}`),
  ];
  if (item.room) lines.push(foldICalLine(`LOCATION:${escapeICalText(item.room)}`));
  if (desc) {
    lines.push(foldICalLine(`DESCRIPTION:${escapeICalText(desc)}`));
  }
  if (item.url) lines.push(foldICalLine(`URL:${item.url}`));
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function calendarDescription(item: ProgramItem, note?: string) {
  const desc: string[] = [];
  if (item.presenter) desc.push(`Presenter: ${item.presenter}`);
  if (item.authors && item.authors !== item.presenter) desc.push(`Authors: ${item.authors}`);
  if (item.sessionTitle) desc.push(`Session: ${item.sessionTitle}`);
  if (item.posterNum) desc.push(`Poster #${item.posterNum}`);
  if (item.abstract) desc.push(item.abstract);
  if (note) desc.push(`Note: ${note}`);
  if (item.url) desc.push(item.url);
  return desc.join("\n\n");
}

export function googleCalendarUrl(item: ProgramItem, note?: string): string | null {
  const times = eventTimes(item);
  if (!times) return null;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: displayTitle(item),
    dates: `${times.date}T${times.start}/${times.date}T${times.end}`,
    ctz: "America/New_York",
  });
  if (item.room) params.set("location", item.room);
  const details = calendarDescription(item, note);
  if (details) params.set("details", details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function openItemInGoogleCalendar(item: ProgramItem, note?: string) {
  const url = googleCalendarUrl(item, note);
  if (!url) {
    window.alert("This item has no scheduled time, so it can't be added to a calendar.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function downloadItemIcs(item: ProgramItem, note?: string) {
  const ics = buildICalForItem(item, note);
  if (!ics) {
    window.alert("This item has no scheduled time, so it can't be added to a calendar.");
    return;
  }
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `netsci2026-${item.sourceId || item.id}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
