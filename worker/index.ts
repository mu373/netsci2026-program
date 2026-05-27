import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import Fuse from "fuse.js";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import programData from "../src/data/program-data.json";
import type { AppData, ProgramItem } from "../src/types";
import type { UIMessage } from "ai";
import { openApiSpec } from "./openapi";

type Env = {
  Bindings: {
    ASSETS: Fetcher;
    GEMINI_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    CHAT_RATE_LIMITER: RateLimit;
    NETSCI2026_CHAT_MESSAGES?: KVNamespace;
    CHAT_MESSAGE_RETENTION_DAYS?: string;
  };
};

type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;
type ListTopicsInput = { query?: string; limit?: number };
type ListTopicItemsInput = { topicId: number; limit?: number };
type ListRelatedItemsInput = { itemId: string; limit?: number };
type SearchProgramsInput = { query: string; limit?: number };
type SearchPeopleInput = { query: string; limit?: number };
type FindPeopleByTopicInput = { query: string; limit?: number };

type ChatMessageRecord = {
  id: string;
  at: string;
  sessionId: string | null;
  messageSource: "template" | "freeform" | null;
  message: string;
  messageCount: number;
  lastUserMessageId?: string;
  country: string | null;
  ray: string | null;
  referrer: string | null;
  userAgent: string | null;
};

const data = programData as AppData;
const itemById = new Map(data.items.map((item) => [item.id, item]));
const personBySlug = new Map(data.people.map((person) => [person.slug, person]));
const clusterById = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));
const peopleFuse = new Fuse(data.people, {
  keys: [
    { name: "name", weight: 3 },
    { name: "roles", weight: 0.5 },
  ],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
});

function limitParam(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function limitNumber(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value) || !value || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function itemId(kind: string, id: string) {
  return `${kind}:${id}`;
}

function textForSearch(item: ProgramItem) {
  return [
    item.id,
    item.title,
    item.abstract,
    item.sessionTitle,
    item.kind,
    item.type,
    item.dayKey,
    item.dayLabel,
    item.time,
    item.room,
    item.presenter,
    item.chair,
    item.authors,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function searchItems(query: string, limit = 12) {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const terms = [...new Set(normalizedQuery
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1))];

  const candidates = terms.length
    ? data.items
        .map((item) => {
          const text = textForSearch(item);
          const hits = terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
          const titleHits = terms.reduce((count, term) => count + (item.title.toLocaleLowerCase().includes(term) ? 2 : 0), 0);
          const exactPhraseBoost = normalizedQuery && text.includes(normalizedQuery) ? 6 : 0;
          const recommendationBoost = item.ranking ? Math.max(0, item.ranking.score - 0.72) * 4 : 0;
          return { item, score: hits + titleHits + exactPhraseBoost + recommendationBoost };
        })
        .filter((entry) => entry.score > 0)
    : data.items
        .filter((item) => item.ranking)
        .map((item) => ({ item, score: item.ranking?.score || 0 }));

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

function searchPeople(query: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...data.people]
      .sort((a, b) => b.itemIds.length - a.itemIds.length || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((person) => ({ person, score: 1 }));
  }
  return peopleFuse.search(trimmed, { limit }).map((result) => ({
    person: result.item,
    score: 1 - (result.score ?? 1),
  }));
}

function findPeopleByTopic(query: string, limit = 12) {
  const matches = searchItems(query, 40);
  const peopleById = new Map<
    string,
    {
      person: {
        id: string;
        slug: string;
        name: string;
        roles: string[];
        path: string;
      };
      score: number;
      itemIds: Set<string>;
      items: ReturnType<typeof compactItemSummary>[];
    }
  >();

  for (const { item, score } of matches) {
    for (const person of data.peopleByItem[item.id] || []) {
      const existing = peopleById.get(person.id);
      if (existing) {
        existing.score += score;
        if (!existing.itemIds.has(item.id)) {
          existing.itemIds.add(item.id);
          existing.items.push(compactItemSummary(item));
        }
        continue;
      }

      peopleById.set(person.id, {
        person: {
          id: person.id,
          slug: person.slug,
          name: person.name,
          roles: person.roles,
          path: `/people/${person.slug}`,
        },
        score,
        itemIds: new Set([item.id]),
        items: [compactItemSummary(item)],
      });
    }
  }

  return [...peopleById.values()]
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .slice(0, limit)
    .map((entry) => ({
      score: entry.score,
      person: entry.person,
      matchedItemCount: entry.itemIds.size,
      items: entry.items.slice(0, 4),
    }));
}

function linkedPeopleForItem(item: ProgramItem) {
  const people = data.peopleByItem[item.id] || [];
  if (people.length) {
    return people.map((person) => `[${person.name}](/people/${person.slug})`).join(", ");
  }
  return item.presenter || item.authors || item.chair || "";
}

function compactItemSummary(item: ProgramItem) {
  const people = data.peopleByItem[item.id] || [];
  return {
    id: item.id,
    title: item.title,
    path: pathForItem(item),
    kind: item.kind,
    type: item.type,
    when: [item.dayLabel, item.time].filter(Boolean).join(" | "),
    room: item.room || "TBA",
    people: people.map((person) => ({
      name: person.name,
      path: `/people/${person.slug}`,
      roles: person.roles,
    })),
    peopleText: linkedPeopleForItem(item),
  };
}

function compactRelatedItems(itemId: string, limit: number) {
  return relatedFor(itemId)
    .slice(0, limit)
    .map(({ item, score }) => ({
      ...compactItemSummary(item),
      similarityScore: score,
    }));
}

function topicItemScore(item: ProgramItem, topicId: number) {
  const assignment = data.clusterByItem[item.id];
  if (!assignment || assignment.primary !== topicId) return null;
  return assignment.top.find((entry) => entry.clusterId === topicId)?.score ?? 0;
}

function topicSummaries() {
  const counts = new Map<number, number>();
  for (const assignment of Object.values(data.clusterByItem)) {
    counts.set(assignment.primary, (counts.get(assignment.primary) || 0) + 1);
  }
  return data.clusters.map((topic) => ({
    ...topic,
    itemCount: counts.get(topic.id) || 0,
  }));
}

function searchTopicSummaries(query: string, limit: number) {
  const terms = query
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1);
  const topics = topicSummaries();
  if (!terms.length) return topics.slice(0, limit);
  return topics
    .map((topic) => {
      const text = `${topic.label} ${topic.description}`.toLocaleLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { topic, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.topic.itemCount - a.topic.itemCount)
    .slice(0, limit)
    .map(({ topic }) => topic);
}

function itemsForTopic(topicId: number, limit: number) {
  return data.items
    .map((item) => {
      const score = topicItemScore(item, topicId);
      return score === null ? null : { item, score };
    })
    .filter((entry): entry is { item: ProgramItem; score: number } => Boolean(entry))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.startH ?? 99) - (b.item.startH ?? 99) ||
        a.item.title.localeCompare(b.item.title),
    )
    .slice(0, limit);
}

function pathForItem(item: ProgramItem) {
  if (item.kind === "session") return `/day/${item.dayKey || data.days.all[0]?.key || "mon"}?item=${item.id}`;
  return `/programs?item=${item.id}`;
}

function conciseItem(item: ProgramItem, index: number) {
  const people = linkedPeopleForItem(item);
  const abstract = item.abstract ? `\nAbstract: ${item.abstract.slice(0, 700)}` : "";
  const related = compactRelatedItems(item.id, 3);
  return [
    `[${index + 1}]`,
    `ID: ${item.id}`,
    `Title: ${item.title}`,
    `Path: ${pathForItem(item)}`,
    `Type: ${[item.kind, item.type].filter(Boolean).join(" / ")}`,
    `When: ${[item.dayLabel, item.time].filter(Boolean).join(" | ")}`,
    `Room: ${item.room || "TBA"}`,
    people ? `People: ${people}` : "",
    related.length
      ? `Related: ${related
          .map((entry) => `${entry.id} (${entry.similarityScore.toFixed(2)}) ${entry.title}`)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .concat(abstract);
}

function contextForQuery(query: string) {
  const results = searchItems(query, 10);
  return {
    results,
    text: results.map(({ item }, index) => conciseItem(item, index)).join("\n\n"),
  };
}

function textFromMessage(message: UIMessage | undefined) {
  if (!message) return "";
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

function lastUserMessage(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index];
  }
  return undefined;
}

function retentionTtlSeconds(retentionDays?: string): number | undefined {
  if (!retentionDays) return undefined;

  const days = Number.parseInt(retentionDays, 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;

  return days * 24 * 60 * 60;
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const sessionId = value.trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(sessionId)) return null;

  return sessionId;
}

function normalizeMessageSource(value: unknown): ChatMessageRecord["messageSource"] {
  return value === "template" || value === "freeform" ? value : null;
}

async function storeChatMessage(
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

const chatTools = {
  searchPrograms: tool<
    SearchProgramsInput,
    {
      query: string;
      results: Array<ReturnType<typeof compactItemSummary> & { searchScore: number }>;
    }
  >({
    description:
      "Search all program items with local lexical search, including breaks, meals, titles, abstracts, people, day, time, and room. Use this for general schedule questions such as lunch, coffee, registration, rooms, dates, and keyword searches.",
    inputSchema: jsonSchema<SearchProgramsInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, for example lunch, coffee, registration, Wednesday morning, or graph neural networks.",
        },
        limit: {
          type: "number",
          description: "Maximum program items to return. Defaults to 12.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: searchItems(query, limitNumber(limit, 12, 40)).map(({ item, score }) => ({
        ...compactItemSummary(item),
        searchScore: score,
      })),
    }),
  }),
  listTopics: tool<ListTopicsInput, ReturnType<typeof searchTopicSummaries>>({
    description:
      "List NetSci program topics/clusters. Use this when the user asks what topics exist, asks for topic options, or uses a broad topical phrase before selecting items.",
    inputSchema: jsonSchema<ListTopicsInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional words to filter topic labels and descriptions.",
        },
        limit: {
          type: "number",
          description: "Maximum topics to return. Defaults to 12.",
        },
      },
      additionalProperties: false,
    }),
    execute: ({ query = "", limit }) => searchTopicSummaries(query, limitNumber(limit, 12, 30)),
  }),
  listItemsInTopic: tool<
    ListTopicItemsInput,
    { topic: NonNullable<ReturnType<typeof clusterById.get>>; items: ReturnType<typeof compactItemSummary>[] }
  >({
    description:
      "List program items whose primary topic is a given topic id. Use topic ids from listTopics or from previous context.",
    inputSchema: jsonSchema<ListTopicItemsInput>({
      type: "object",
      properties: {
        topicId: {
          type: "number",
          description: "Numeric topic id from the topics list.",
        },
        limit: {
          type: "number",
          description: "Maximum items to return. Defaults to 12.",
        },
      },
      required: ["topicId"],
      additionalProperties: false,
    }),
    execute: ({ topicId, limit }) => {
      const topic = clusterById.get(topicId);
      if (!topic) throw new Error(`Topic ${topicId} was not found.`);
      return {
        topic,
        items: itemsForTopic(topicId, limitNumber(limit, 12, 40)).map(({ item, score }) => ({
          ...compactItemSummary(item),
          topicScore: score,
        })),
      };
    },
  }),
  listRelatedItems: tool<
    ListRelatedItemsInput,
    { item: ReturnType<typeof compactItemSummary>; related: ReturnType<typeof compactRelatedItems> }
  >({
    description:
      "List items that are semantically related to a known program item id. Use this when the user asks for similar talks/posters, alternatives, or follow-up recommendations.",
    inputSchema: jsonSchema<ListRelatedItemsInput>({
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "Program item id, such as talk:123, poster:45, or session:w-s1.",
        },
        limit: {
          type: "number",
          description: "Maximum related items to return. Defaults to 8.",
        },
      },
      required: ["itemId"],
      additionalProperties: false,
    }),
    execute: ({ itemId, limit }) => {
      const item = itemById.get(itemId);
      if (!item) throw new Error(`Item ${itemId} was not found.`);
      return {
        item: compactItemSummary(item),
        related: compactRelatedItems(item.id, limitNumber(limit, 8, 20)),
      };
    },
  }),
  findPeopleByTopic: tool<
    FindPeopleByTopicInput,
    {
      query: string;
      results: ReturnType<typeof findPeopleByTopic>;
    }
  >({
    description:
      "Find presenters, authors, and chairs connected to a topical query by searching matching program items and aggregating their people. Use this for questions like 'who works on mobility?' or 'who works on science of science?'",
    inputSchema: jsonSchema<FindPeopleByTopicInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Topical phrase to search for, for example mobility, science of science, epidemics, or temporal networks.",
        },
        limit: {
          type: "number",
          description: "Maximum people to return. Defaults to 10.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: findPeopleByTopic(query, limitNumber(limit, 10, 30)),
    }),
  }),
  searchPeople: tool<
    SearchPeopleInput,
    {
      query: string;
      results: Array<{
        score: number;
        person: {
          id: string;
          slug: string;
          name: string;
          roles: string[];
          itemCount: number;
          path: string;
        };
        items: ReturnType<typeof compactItemSummary>[];
      }>;
    }
  >({
    description:
      "Fuzzy-search presenters, authors, and chairs by name. Use this for person-name queries or when a user asks what someone is presenting.",
    inputSchema: jsonSchema<SearchPeopleInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Person name or partial name to search for.",
        },
        limit: {
          type: "number",
          description: "Maximum people to return. Defaults to 8.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: searchPeople(query, limitNumber(limit, 8, 20)).map(({ person, score }) => ({
        score,
        person: {
          id: person.id,
          slug: person.slug,
          name: person.name,
          roles: person.roles,
          itemCount: person.itemIds.length,
          path: `/people/${person.slug}`,
        },
        items: person.itemIds
          .map((id) => itemById.get(id))
          .filter((item): item is ProgramItem => Boolean(item))
          .slice(0, 8)
          .map(compactItemSummary),
      })),
    }),
  }),
};

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
  const items = person.itemIds.map((id) => itemById.get(id)).filter(Boolean);
  return c.json({ person, items });
});

app.get("/api/related", (c) => {
  const id = c.req.query("id") || "";
  if (!itemById.has(id)) return c.json({ error: "Item not found" }, 404);
  return c.json({ item: itemById.get(id), related: relatedFor(id) });
});

app.get("/api/search", (c) => {
  const query = c.req.query("q") || "";
  const limit = Number(c.req.query("limit") || 12);
  return c.json({ query, results: searchItems(query, limit) });
});

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : [];
  const latestUser = lastUserMessage(messages);
  const query = textFromMessage(latestUser);
  const sessionId = normalizeSessionId(body.sessionId);
  const messageSource = normalizeMessageSource(body.messageSource);
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

  const google = createGoogleGenerativeAI({ apiKey });
  const { text: context } = contextForQuery(query);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: [
      "You are the NetSci 2026 unofficial guide chat assistant: friendly, clear, and helpful without being chatty.",
      "Answer using only the provided local conference program context and the conversation.",
      "For questions asking who works on, studies, researches, or is active in a topic, use findPeopleByTopic and answer with a concise Markdown bullet list of linked people. Do not return program_recommendations JSON unless the user asks for talks, posters, sessions, works, or recommendations.",
      "If your answer names, lists, cites, or recommends any specific program items, return only JSON with this schema:",
      '{"kind":"program_recommendations","intro":"short answer","items":[{"id":"talk:123","summary":"one short substantive summary"}],"outro":""}',
      "Use only item IDs that appear in the retrieved context. Do not include title, date, room, presenter, URL, or markdown in the JSON; the app renders those fields.",
      "Every recommended item must include a non-empty summary. For each summary, describe the work's actual substance from the abstract or context in one useful sentence. Do not restate the title, presenter, date, room, or that someone is presenting it.",
      "Retrieved items include a few related item IDs. Use them to suggest adjacent or follow-up talks/posters when helpful.",
      "You can use tools to search programs, find people by topic, list topics, list items in a topic, list related items for a known item ID, and fuzzy-search people. Use searchPrograms for schedule/logistics questions such as lunch, coffee, registration, room, day, or time, and for keyword searches that vector retrieval might miss.",
      "When answering about topics, state that the topics are based on clustering of program-item embeddings, not official conference tracks.",
      "If tools return program item IDs, those IDs are valid context for the JSON recommendations schema.",
      "Only use concise GitHub-flavored Markdown when the answer does not mention specific talks, posters, or sessions.",
      "When giving a list in Markdown, including people, topics, names, or options, always format each entry as a bullet point using '- '; never put list entries on separate bare lines.",
      "When mentioning a person and a /people/... path is available in context or tool results, format the name as a Markdown link: [Name](/people/slug).",
      "Prefer 3 to 6 strongest matches unless the user asks for more.",
      "If the context is insufficient, say what is missing and suggest a better search query.",
      "Keep answers concise and practical, but end useful answers with one brief next-step offer, such as asking whether the user wants relevant works, times, or related people.",
      "",
      "Retrieved program context (lexical search):",
      context || "No matching context was retrieved.",
    ].join("\n"),
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

function relatedFor(id: string) {
  return (data.related[id] || [])
    .map((entry) => ({ score: entry.score, item: itemById.get(entry.id) }))
    .filter((entry): entry is { score: number; item: ProgramItem } => Boolean(entry.item));
}

export default app;
