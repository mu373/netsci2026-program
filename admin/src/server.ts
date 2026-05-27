import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { readChatLogs } from "./chatLogs.js";

const adminRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = join(adminRoot, "dist");
const PORT = Number.parseInt(process.env.NETSCI2026_ADMIN_PORT ?? "8788", 10);
const HOST = process.env.NETSCI2026_ADMIN_HOST ?? "127.0.0.1";

function requestUrl(req: IncomingMessage) {
  const host = req.headers.host ?? `${HOST}:${PORT}`;
  return new URL(req.url ?? "/", `http://${host}`);
}

function requestHeaders(req: IncomingMessage) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function contentType(path: string) {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function staticResponse(path: string) {
  return new Response(readFileSync(path), {
    headers: {
      "cache-control": "no-store",
      "content-type": contentType(path),
    },
  });
}

const app = new Hono();

app.get("/api/chat-logs", async (c) => {
  const records = await readChatLogs(new URL(c.req.url));
  return c.json({ records }, 200, { "cache-control": "no-store" });
});

app.get("/", () => staticResponse(join(distRoot, "index.html")));
app.get("/chat-logs", () => staticResponse(join(distRoot, "index.html")));
app.get("/assets/*", (c) => {
  const path = new URL(c.req.url).pathname.replace(/^\/+/, "");
  return staticResponse(join(distRoot, path));
});

app.notFound((c) => c.text("Not found", 404));

app.onError((error, c) =>
  c.json(
    {
      error: error instanceof Error ? error.message : "Unknown error",
    },
    500,
    {
      "cache-control": "no-store",
    },
  ),
);

const server = createServer(async (req, res) => {
  const response = await app.fetch(
    new Request(requestUrl(req).toString(), {
      method: req.method,
      headers: requestHeaders(req),
    }),
  );
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(body);
});

server.listen(PORT, HOST, () => {
  console.log(`NetSci 2026 chat logs admin running at http://${HOST}:${PORT}`);
});
