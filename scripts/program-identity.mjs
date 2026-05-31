import crypto from "node:crypto";

export function compactIdentityText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeIdentityText(value) {
  return compactIdentityText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function shortHash(value, length = 10) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function knownSourceId(value) {
  if (value === null || value === undefined) return "";
  const clean = compactIdentityText(value);
  if (!clean || clean === "undefined" || clean === "null") return "";
  return clean;
}

export function itemSourceId(kind, record) {
  if (kind === "session") return knownSourceId(record.id);
  if (kind === "poster") return knownSourceId(record.num);
  if (kind === "talk") {
    const officialId = knownSourceId(record.id);
    if (officialId) return officialId;
    const sessionId = knownSourceId(record.sessionId) || knownSourceId(record.dayKey) || "unknown-session";
    const talkIndex = record.talkIndex === null || record.talkIndex === undefined ? "x" : String(record.talkIndex);
    const titleHash = shortHash(`${record.title ?? ""}|${record.authors ?? ""}|${record.presenter ?? ""}`, 8);
    return `missing-${sessionId}-${talkIndex}-${titleHash}`;
  }
  throw new Error(`Unknown program item kind: ${kind}`);
}

export function sourceKey(kind, sourceId) {
  return `${kind}:${sourceId}`;
}

export function baseItemId(kind, sourceId) {
  return `${kind}:${sourceId}`;
}

export function identityFingerprint(kind, record) {
  if (kind === "session") {
    return shortHash(
      [
        kind,
        normalizeIdentityText(record.title),
      ].join("|"),
      16,
    );
  }
  if (kind === "talk") {
    return shortHash(
      [
        kind,
        normalizeIdentityText(record.title),
      ].join("|"),
      16,
    );
  }
  if (kind === "poster") {
    return shortHash(
      [
        kind,
        normalizeIdentityText(record.title),
      ].join("|"),
      16,
    );
  }
  throw new Error(`Unknown program item kind: ${kind}`);
}

export function identitySnapshot(kind, record) {
  const sourceId = itemSourceId(kind, record);
  const fingerprint = identityFingerprint(kind, record);
  return {
    sourceId,
    sourceKey: sourceKey(kind, sourceId),
    baseId: baseItemId(kind, sourceId),
    fingerprint,
  };
}
