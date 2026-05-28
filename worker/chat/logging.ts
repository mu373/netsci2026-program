import type { Context } from "hono";
import type { ChatMessageRecord, Env } from "../types";

function retentionTtlSeconds(retentionDays?: string): number | undefined {
  if (!retentionDays) return undefined;

  const days = Number.parseInt(retentionDays, 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;

  return days * 24 * 60 * 60;
}

export function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const sessionId = value.trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(sessionId)) return null;

  return sessionId;
}

export function normalizeMessageSource(value: unknown): ChatMessageRecord["messageSource"] {
  return value === "template" || value === "freeform" ? value : null;
}

export async function storeChatMessage(
  c: Context<Env>,
  message: string,
  messageCount: number,
  sessionId: string | null,
  messageSource: ChatMessageRecord["messageSource"],
  lastUserMessageId?: string,
) {
  const messageStore = c.env.NETSCI2026_CHAT_MESSAGES;
  const trimmed = message.trim();
  if (!messageStore || !trimmed) return;

  const at = new Date().toISOString();
  const id = crypto.randomUUID();
  const record: ChatMessageRecord = {
    id,
    at,
    sessionId,
    messageSource,
    message: trimmed,
    messageCount,
    lastUserMessageId,
    country: c.req.header("cf-ipcountry") ?? null,
    ray: c.req.header("cf-ray") ?? null,
    referrer: c.req.header("referer") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  };

  const expirationTtl = retentionTtlSeconds(c.env.CHAT_MESSAGE_RETENTION_DAYS);
  await messageStore.put(
    `netsci2026:chat-message:${at}:${id}`,
    JSON.stringify(record),
    {
      ...(expirationTtl ? { expirationTtl } : {}),
      metadata: {
        at,
        sessionId,
        messageSource,
        messagePreview: trimmed.slice(0, 120),
      },
    },
  );
}
