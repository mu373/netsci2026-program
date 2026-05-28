import { openApiComponents } from "./openapi/components";
import { openApiPaths } from "./openapi/paths";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "NetSci 2026 Program API",
    version: "0.1.0",
    summary: "Program, people, topic, search, related-item, and chat endpoints for the NetSci 2026 unofficial guide.",
    description: [
      "This API serves the bundled NetSci 2026 guide data used by the web app.",
      "Use it to browse the conference schedule, find people, inspect embedding-derived topics, discover related talks/posters/sessions, and call the program-grounded chat endpoint.",
      "Program items use stable ids in the form `kind:sourceId`, such as `talk:51`, `poster:3`, or `session:m-brk0`.",
    ].join("\n\n"),
  },
  servers: [
    {
      url: "/",
      description: "Current origin",
    },
  ],
  tags: [
    { name: "Program", description: "Conference sessions, talks, posters, breaks, rooms, and related items." },
    { name: "Topics", description: "Embedding-derived topical clusters. These are not official conference tracks." },
    { name: "People", description: "Presenters, authors, chairs, and their associated program items." },
    { name: "Search", description: "Lexical search over program items and fuzzy search over people." },
    { name: "Chat", description: "Streaming AI assistant responses grounded in local program data." },
    { name: "Metadata", description: "OpenAPI and Scalar documentation endpoints." },
  ],
  paths: openApiPaths,
  components: openApiComponents,
} as const;
