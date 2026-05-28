import { itemById, people } from "../data";
import { displayTitle } from "./programHelpers";
import type { ProgramItem } from "../types";

export type ProgramRecommendationPayload = {
  kind: "program_recommendations";
  intro?: string;
  items: { id: string; summary?: string }[];
  outro?: string;
};

function linkifyLocalPaths(markdown: string) {
  return markdown
    .replace(/\b(?:URL|Path):\s*(\/(?:programs|day|people)[^\s)]+)/g, "[Open item]($1)")
    .replace(/(?<!\]\()(?<!\()(\/(?:programs|day|people)[^\s)]+)/g, "[$1]($1)");
}

const personLinks = people
  .filter((person) => person.name.length >= 4)
  .sort((a, b) => b.name.length - a.name.length)
  .map((person) => ({
    name: person.name,
    path: `/people/${person.slug}`,
  }));
const personPaths = new Set(personLinks.map((person) => person.path));

function markdownProtectedRanges(markdown: string) {
  const ranges: { start: number; end: number }[] = [];
  const patterns = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /\[[^\]]+\]\([^)]+\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      if (match.index === undefined) continue;
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

function isNameBoundary(value: string | undefined) {
  return !value || !/[\p{L}\p{N}_]/u.test(value);
}

function linkifyPersonSegment(segment: string) {
  let output = "";
  let index = 0;

  while (index < segment.length) {
    const person = personLinks.find((entry) => {
      if (!segment.startsWith(entry.name, index)) return false;
      return isNameBoundary(segment[index - 1]) && isNameBoundary(segment[index + entry.name.length]);
    });

    if (person) {
      output += `[${person.name}](${person.path})`;
      index += person.name.length;
      continue;
    }

    output += segment[index];
    index += 1;
  }

  return output;
}

function linkifyPeople(markdown: string) {
  const ranges = markdownProtectedRanges(markdown);
  if (!ranges.length) return linkifyPersonSegment(markdown);

  let output = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    output += linkifyPersonSegment(markdown.slice(cursor, range.start));
    output += markdown.slice(range.start, range.end);
    cursor = range.end;
  }
  output += linkifyPersonSegment(markdown.slice(cursor));
  return output;
}

function standalonePersonLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || /^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) return false;
  const match = trimmed.match(/^\[[^\]]+\]\((\/people\/[^)\s]+)\)[.!?]?$/);
  return Boolean(match && personPaths.has(match[1]));
}

function formatPersonLists(markdown: string) {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let personBlock: { line: string; blankBefore: string[] }[] = [];
  let pendingBlankLines: string[] = [];

  function flushPersonBlock() {
    if (personBlock.length >= 2) {
      output.push(...personBlock.map((entry) => `- ${entry.line.trim()}`));
    } else {
      for (const entry of personBlock) {
        output.push(...entry.blankBefore, entry.line);
      }
    }
    personBlock = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      if (personBlock.length) {
        pendingBlankLines.push(line);
      } else {
        output.push(line);
      }
      continue;
    }

    if (standalonePersonLine(line)) {
      personBlock.push({ line, blankBefore: pendingBlankLines });
      pendingBlankLines = [];
      continue;
    }

    flushPersonBlock();
    output.push(...pendingBlankLines);
    pendingBlankLines = [];
    output.push(line);
  }

  flushPersonBlock();
  output.push(...pendingBlankLines);
  return output.join("\n");
}

export function formatChatMarkdown(markdown: string) {
  return formatPersonLists(linkifyPeople(linkifyLocalPaths(markdown)));
}

export function pathForItem(item: ProgramItem) {
  if (item.kind === "session") return `/day/${item.dayKey || "mon"}?item=${item.id}`;
  return `/programs?item=${item.id}`;
}

export function resolveRecommendationId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (itemById.has(raw)) return raw;

  const pathMatch = raw.match(/[?&]item=([^&\s]+)/);
  if (pathMatch) {
    const decoded = decodeURIComponent(pathMatch[1]);
    if (itemById.has(decoded)) return decoded;
  }

  for (const kind of ["talk", "poster", "session"]) {
    const id = `${kind}:${raw.replace(/^(talk|poster|session):/, "")}`;
    if (itemById.has(id)) return id;
  }

  return null;
}

export function parseProgramRecommendations(text: string): ProgramRecommendationPayload | null {
  const trimmed = text.trim();
  const unfenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? trimmed;
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const payload = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    if (payload.kind !== "program_recommendations" && !Array.isArray(payload.items)) return null;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const id = resolveRecommendationId(record.id ?? record.itemId ?? record.item_id);
        if (!id) return null;
        return {
          id,
          summary: typeof record.summary === "string" ? record.summary : "",
        };
      })
      .filter((entry): entry is { id: string; summary: string } => Boolean(entry));
    if (!items.length) return null;
    return {
      kind: "program_recommendations",
      intro: typeof payload.intro === "string" ? payload.intro : "",
      items,
      outro: typeof payload.outro === "string" ? payload.outro : "",
    };
  } catch {
    return null;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownToPlainText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanRecommendationSummary(value: string, item: ProgramItem | undefined) {
  let cleaned = markdownToPlainText(value)
    .replace(/^[\s:;,.!?-]+/, "")
    .trim();

  if (item) {
    const titlePattern = new RegExp(`^${escapeRegExp(displayTitle(item))}\\s*(?::|[-–—])?\\s*`, "i");
    cleaned = cleaned.replace(titlePattern, "").trim();
  }

  return cleaned;
}

export function parseProgramReferenceList(text: string): ProgramRecommendationPayload | null {
  const lines = text.split(/\n+/);
  const refs: { id: string; summary: string; lineIndex: number }[] = [];

  lines.forEach((line, lineIndex) => {
    const match = line.match(/\b(?:talk|poster|session):[A-Za-z0-9_-]+\b/);
    const id = resolveRecommendationId(match?.[0]);
    if (!id) return;
    const item = itemById.get(id);
    const cleaned = line
      .replace(/\b(?:talk|poster|session):[A-Za-z0-9_-]+\b/g, "")
      .replace(/^[\s>*-]*(?:\d+\.)?\s*/, "")
      .trim();
    const summary = cleanRecommendationSummary(cleaned, item);
    refs.push({
      id,
      summary,
      lineIndex,
    });
  });

  if (refs.length < 1) return null;
  const first = refs[0].lineIndex;
  const last = refs[refs.length - 1].lineIndex;
  return {
    kind: "program_recommendations",
    intro: lines.slice(0, first).join("\n").trim(),
    items: refs.map(({ id, summary }) => ({ id, summary })),
    outro: lines.slice(last + 1).join("\n").trim(),
  };
}

export function looksLikeRecommendationJson(text: string) {
  const trimmed = text.trim();
  return (
    trimmed === "`" ||
    trimmed === "``" ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith('"kind"') ||
    trimmed.startsWith('"items"') ||
    trimmed.includes('"program_recommendations"') ||
    trimmed.includes('"items"')
  );
}

export function itemMeta(item: ProgramItem) {
  return {
    when: [item.dayLabel, item.time].filter(Boolean).join(", ") || "To Be Announced",
    where: item.room || "To Be Announced",
    presenter: item.presenter || item.authors || item.chair || "To Be Announced",
  };
}

export function localItemSummary(item: ProgramItem) {
  const cleaned = item.abstract.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentence = cleaned.match(/^.{80,220}?(?:[.!?](?:\s|$)|$)/)?.[0] || cleaned.slice(0, 220);
  return sentence.length < cleaned.length && !/[.!?]$/.test(sentence) ? `${sentence.trim()}...` : sentence.trim();
}
