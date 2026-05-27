import { useEffect, useMemo, useState } from "react";
import type { ChatLogRecord } from "./types.js";

type SourceFilter = "all" | "freeform" | "template";

type ChatLogsResponse = {
  records: ChatLogRecord[];
  error?: string;
};

type SessionGroup = {
  sessionId: string;
  messages: ChatLogRecord[];
  last: string;
};

function time(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function matches(record: ChatLogRecord, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    record.message,
    record.sessionId,
    record.messageSource,
    record.country,
    record.referrer,
    record.userAgent,
  ].some((value) => String(value ?? "").toLowerCase().includes(q));
}

function groupedSessions(records: ChatLogRecord[]): SessionGroup[] {
  const groups = new Map<string, ChatLogRecord[]>();

  for (const record of records) {
    const key = record.sessionId || "(no-session)";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return [...groups.entries()]
    .map(([sessionId, messages]) => {
      const sorted = [...messages].sort((a, b) => a.at.localeCompare(b.at));
      return {
        sessionId,
        messages: sorted,
        last: sorted[sorted.length - 1]?.at ?? "",
      };
    })
    .sort((a, b) => b.last.localeCompare(a.last));
}

function Metadata({ record }: { record: ChatLogRecord }) {
  if (!record.referrer && !record.userAgent && !record.ray) return null;

  return (
    <details>
      <summary>Metadata</summary>
      <dl>
        {record.referrer && (
          <>
            <dt>Referrer</dt>
            <dd>{record.referrer}</dd>
          </>
        )}
        {record.userAgent && (
          <>
            <dt>User agent</dt>
            <dd>{record.userAgent}</dd>
          </>
        )}
        {record.ray && (
          <>
            <dt>Ray</dt>
            <dd>{record.ray}</dd>
          </>
        )}
      </dl>
    </details>
  );
}

function MessageRow({ record }: { record: ChatLogRecord }) {
  const source = record.messageSource ?? "unknown";

  return (
    <tr>
      <td className="date-cell">
        <time dateTime={record.at}>{time(record.at)}</time>
      </td>
      <td className="type-cell">
        <span className={`source source-${source}`}>{source}</span>
      </td>
      <td className="message-cell">
        <p className="message">{record.message}</p>
        {record.country && <span className="country">{record.country}</span>}
        <Metadata record={record} />
      </td>
    </tr>
  );
}

function Session({ session }: { session: SessionGroup }) {
  return (
    <article className="session">
      <div className="session-head">
        <div>
          <code title={session.sessionId}>{session.sessionId}</code>
        </div>
        <span className="pill">{session.messages.length} messages</span>
      </div>
      <div className="message-table-wrap">
        <table className="message-table">
          <colgroup>
            <col className="date-col" />
            <col className="type-col" />
            <col className="message-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Message</th>
            </tr>
          </thead>
          <tbody>
            {session.messages.map((record) => (
              <MessageRow key={record.key} record={record} />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function App() {
  const [records, setRecords] = useState<ChatLogRecord[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ source, limit: "500" });
      const response = await fetch(`/api/chat-logs?${params.toString()}`);
      const body = (await response.json()) as ChatLogsResponse;

      if (!response.ok) {
        throw new Error(body.error || "Could not load chat logs.");
      }

      setRecords(body.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chat logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const filteredRecords = useMemo(
    () => records.filter((record) => matches(record, query)),
    [records, query],
  );
  const sessions = useMemo(
    () => groupedSessions(filteredRecords),
    [filteredRecords],
  );
  const freeformCount = filteredRecords.filter(
    (record) => record.messageSource === "freeform",
  ).length;
  const templateCount = filteredRecords.filter(
    (record) => record.messageSource === "template",
  ).length;

  return (
    <main>
      <header className="top">
        <div>
          <h1>NetSci 2026 Chat Logs</h1>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </header>

      <section className="toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          placeholder="Search messages, sessions, metadata"
        />
        <select
          value={source}
          onChange={(event) => setSource(event.target.value as SourceFilter)}
        >
          <option value="all">All messages</option>
          <option value="freeform">Freeform only</option>
          <option value="template">Template only</option>
        </select>
      </section>

      <section className="stats">
        <div className="stat">
          <span>Total</span>
          <strong>{filteredRecords.length}</strong>
        </div>
        <div className="stat">
          <span>Sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div className="stat">
          <span>Freeform</span>
          <strong>{freeformCount}</strong>
        </div>
        <div className="stat">
          <span>Template</span>
          <strong>{templateCount}</strong>
        </div>
      </section>

      <section className="sessions">
        {error && <div className="notice">{error}</div>}
        {!error && loading && filteredRecords.length === 0 && (
          <div className="notice">Loading chat logs...</div>
        )}
        {!error && !loading && filteredRecords.length === 0 && (
          <div className="notice">No matching messages.</div>
        )}
        {!error &&
          sessions.map((session) => (
            <Session key={session.sessionId} session={session} />
          ))}
      </section>
    </main>
  );
}
