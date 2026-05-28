import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
} from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { openApiSpec } from "./openapi";
import { chatTools } from "./chat/tools";
import {
  isPromptInjectionAttempt,
  lastUserMessage,
  normalizeSavedItems,
  streamAssistantText,
  systemPromptForChat,
  textFromMessage,
} from "./chat/prompt";
import {
  normalizeMessageSource,
  normalizeSessionId,
  storeChatMessage,
} from "./chat/logging";
import {
  clusterById,
  data,
  findPeopleByTopic,
  itemById,
  itemId,
  itemsForTopic,
  limitParam,
  personBySlug,
  relatedFor,
  searchItems,
  searchPeople,
  topicSummaries,
} from "./program";
import type { UIMessage } from "ai";
import type { Env } from "./types";
import type { ProgramItem } from "../src/types";

const app = new Hono<Env>();
app.use("/api/*", cors());

function chatApiKey(env: Env["Bindings"]) {
  return env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || "";
}

app.get("/openapi.json", (c) => c.json(openApiSpec));
app.get("/api/openapi.json", (c) => c.json(openApiSpec));
app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: "NetSci 2026 Program API" }));
app.get("/api/docs", Scalar({ url: "/openapi.json", pageTitle: "NetSci 2026 Program API" }));

app.get("/api/config", (c) =>
  c.json({
    features: {
      chat: Boolean(chatApiKey(c.env)),
    },
  }),
);

app.use("/api/chat", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.CHAT_RATE_LIMITER.limit({
    key: `chat:${ip}`,
  });

  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });
  }

  await next();
});

app.get("/api/program", (c) =>
  c.json({
    generatedAt: data.generatedAt,
    days: data.days,
    rankingMeta: data.rankingMeta,
    items: data.items,
  }),
);

app.get("/api/item/:kind/:id", (c) => {
  const item = itemById.get(itemId(c.req.param("kind"), c.req.param("id")));
  if (!item) return c.json({ error: "Item not found" }, 404);
  return c.json({ item, people: data.peopleByItem[item.id] || [], related: relatedFor(item.id) });
});

app.get("/api/topics", (c) => c.json({ topics: topicSummaries() }));

app.get("/api/topics/:id/items", (c) => {
  const topicId = Number(c.req.param("id"));
  const topic = clusterById.get(topicId);
  if (!topic) return c.json({ error: "Topic not found" }, 404);
  const limit = limitParam(c.req.query("limit"), 100, 500);
  return c.json({ topic, items: itemsForTopic(topicId, limit) });
});

app.get("/api/people", (c) => c.json({ people: data.people }));

app.get("/api/people/search", (c) => {
  const query = c.req.query("q") || "";
  const limit = limitParam(c.req.query("limit"), 12, 100);
  return c.json({ query, results: searchPeople(query, limit) });
});

app.get("/api/people/by-topic", (c) => {
  const query = c.req.query("q") || "";
  const limit = limitParam(c.req.query("limit"), 10, 100);
  return c.json({ query, results: findPeopleByTopic(query, limit) });
});

app.get("/api/people/:slug", (c) => {
  const person = personBySlug.get(c.req.param("slug"));
  if (!person) return c.json({ error: "Person not found" }, 404);
  const items = person.itemIds
    .map((id) => itemById.get(id))
    .filter((item): item is ProgramItem => Boolean(item));
  return c.json({ person, items });
});

app.get("/api/related", (c) => {
  const id = c.req.query("id") || "";
  if (!itemById.has(id)) return c.json({ error: "Item not found" }, 404);
  return c.json({ item: itemById.get(id), related: relatedFor(id) });
});

app.get("/api/search", (c) => {
  const query = c.req.query("q") || "";
  const limit = limitParam(c.req.query("limit"), 12, 100);
  return c.json({ query, results: searchItems(query, limit) });
});

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : [];
  const latestUser = lastUserMessage(messages);
  const query = textFromMessage(latestUser);
  const sessionId = normalizeSessionId(body.sessionId);
  const messageSource = normalizeMessageSource(body.messageSource);
  const savedItems = normalizeSavedItems(body.savedItems);
  const apiKey = chatApiKey(c.env);

  await storeChatMessage(
    c,
    query,
    messages.length,
    sessionId,
    messageSource,
    latestUser?.id,
  ).catch((error) => console.error("storeChatMessage error:", error));

  if (!apiKey) {
    return c.json({ error: "Chat is disabled because Gemini is not configured." }, 503);
  }

  if (isPromptInjectionAttempt(query)) {
    return streamAssistantText(
      messages,
      "I cannot help override chat instructions, reveal hidden prompts, or expose secrets. Ask a NetSci 2026 program question instead.",
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPromptForChat(query, savedItems),
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(4),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: () => "The Gemini request failed. Try again in a moment.",
  });
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
