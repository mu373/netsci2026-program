import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ChatLogRecord } from "./types.js";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const CHAT_MESSAGE_KEY_PREFIX = "netsci2026:chat-message:";
const CHAT_MESSAGES_BINDING = "NETSCI2026_CHAT_MESSAGES";

type KvKey = {
  name: string;
  metadata?: {
    at?: string;
    sessionId?: string | null;
    messageSource?: ChatLogRecord["messageSource"];
    messagePreview?: string;
  };
};

function stripJsonComments(input: string) {
  return input.replace(/(^|\s)\/\/.*$/gm, "");
}

function namespaceId() {
  if (process.env.NETSCI2026_CHAT_MESSAGES_KV_NAMESPACE_ID) {
    return process.env.NETSCI2026_CHAT_MESSAGES_KV_NAMESPACE_ID;
  }

  const config = JSON.parse(
    stripJsonComments(readFileSync(`${repoRoot}/wrangler.jsonc`, "utf8")),
  ) as {
    kv_namespaces?: Array<{ binding?: string; id?: string }>;
  };
  const id = config.kv_namespaces?.find(
    (namespace) => namespace.binding === CHAT_MESSAGES_BINDING,
  )?.id;

  if (!id) {
    throw new Error(
      `Could not find ${CHAT_MESSAGES_BINDING} in wrangler.jsonc. Set NETSCI2026_CHAT_MESSAGES_KV_NAMESPACE_ID or add a kv_namespaces binding.`,
    );
  }

  return id;
}

async function wranglerKv(args: string[]) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "wrangler", "kv", "key", ...args],
    {
      cwd: repoRoot,
      maxBuffer: 20_000_000,
      timeout: 20_000,
    },
  );
  return stdout;
}

async function mapInBatches<T, U>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<U>,
) {
  const results: U[] = [];

  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(fn))));
  }

  return results;
}

async function getRecord(ns: string, key: string): Promise<ChatLogRecord | null> {
  const raw = await wranglerKv([
    "get",
    key,
    "--namespace-id",
    ns,
    "--remote",
    "--text",
  ]);

  try {
    const record = JSON.parse(raw) as ChatLogRecord;
    if (typeof record.at !== "string" || typeof record.message !== "string") {
      return null;
    }

    return { ...record, key };
  } catch {
    return null;
  }
}

function recordFromMetadata(key: KvKey): ChatLogRecord | null {
  const id = key.name.slice(key.name.lastIndexOf(":") + 1);
  const at =
    key.metadata?.at ??
    key.name.slice(CHAT_MESSAGE_KEY_PREFIX.length, key.name.lastIndexOf(":"));
  const message = key.metadata?.messagePreview;

  if (!at || !message) return null;

  return {
    key: key.name,
    id,
    at,
    sessionId: key.metadata?.sessionId ?? null,
    messageSource: key.metadata?.messageSource ?? null,
    message,
    messageCount: 0,
    country: null,
    ray: null,
    referrer: null,
    userAgent: null,
  };
}

export async function readChatLogs(url: URL) {
  const ns = namespaceId();
  const source = url.searchParams.get("source");
  const mode = url.searchParams.get("mode");
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "200", 10) || 200,
    500,
  );
  const listRaw = await wranglerKv([
    "list",
    "--namespace-id",
    ns,
    "--prefix",
    CHAT_MESSAGE_KEY_PREFIX,
    "--remote",
  ]);
  const keys = (JSON.parse(listRaw) as KvKey[])
    .filter((key) => {
      if (source !== "template" && source !== "freeform") return true;
      return key.metadata?.messageSource === source;
    })
    .slice(-limit);

  const records =
    mode === "full"
      ? (
          await mapInBatches(keys.map((key) => key.name), 2, (key) =>
            getRecord(ns, key),
          )
        ).filter((record): record is ChatLogRecord => record !== null)
      : keys
          .map(recordFromMetadata)
          .filter((record): record is ChatLogRecord => record !== null);

  return records.sort((a, b) => b.at.localeCompare(a.at));
}
