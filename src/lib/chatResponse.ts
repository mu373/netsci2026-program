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

export function formatChatMarkdown(markdown: string) {
  return linkifyLocalPaths(markdown);
}

export function pathForItem(item: ProgramItem) {
  if (item.kind === "session") return `/day/${item.dayKey || "mon"}?item=${item.id}`;
  return `/programs?item=${item.id}`;
}

export function resolveRecommendationId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  const itemIdPattern = /^(talk|poster|session):[A-Za-z0-9_-]+$/;
  if (itemIdPattern.test(raw)) return raw;

  const pathMatch = raw.match(/[?&]item=([^&\s]+)/);
  if (pathMatch) {
    const decoded = decodeURIComponent(pathMatch[1]);
    if (itemIdPattern.test(decoded)) return decoded;
  }

  return null;
}

export function parseProgramRecommendations(text: string): ProgramRecommendationPayload | null {
  const trimmed = text.trim();
  const unfenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? trimmed;

  for (const candidate of jsonObjectCandidates(unfenced)) {
    try {
      const payload = JSON.parse(candidate) as Record<string, unknown>;
      const recommendations = normalizeProgramRecommendations(payload);
      if (recommendations) return recommendations;
    } catch {
      // Try the next JSON-looking object in the message.
    }
  }

  return null;
}

function jsonObjectCandidates(text: string) {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function normalizeProgramRecommendations(
  payload: Record<string, unknown>,
): ProgramRecommendationPayload | null {
  if (payload.kind !== "program_recommendations" || !Array.isArray(payload.items)) return null;
  const items = payload.items
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
    const titlePattern = new RegExp(`^${escapeRegExp(displayItemTitle(item))}\\s*(?::|[-–—])?\\s*`, "i");
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
    const cleaned = line
      .replace(/\b(?:talk|poster|session):[A-Za-z0-9_-]+\b/g, "")
      .replace(/^[\s>*-]*(?:\d+\.)?\s*/, "")
      .trim();
    refs.push({
      id,
      summary: cleanRecommendationSummary(cleaned, undefined),
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
    /(?:^|\n)\s*\{\s*$/.test(text) ||
    /(?:^|\n)\s*\{\s*"kind"\s*:/.test(text) ||
    /(?:^|\n)\s*\{\s*"items"\s*:/.test(text) ||
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

export function displayItemTitle(item: ProgramItem) {
  const title = item.title.trim();
  if (title) return title;
  if (item.type) return titleCase(item.type);
  return titleCase(item.kind);
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function localItemSummary(item: ProgramItem) {
  const cleaned = item.abstract.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentence = cleaned.match(/^.{80,220}?(?:[.!?](?:\s|$)|$)/)?.[0] || cleaned.slice(0, 220);
  return sentence.length < cleaned.length && !/[.!?]$/.test(sentence) ? `${sentence.trim()}...` : sentence.trim();
}
