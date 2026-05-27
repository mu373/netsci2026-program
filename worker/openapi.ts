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
  paths: {
    "/openapi.json": {
      get: {
        tags: ["Metadata"],
        summary: "Get this OpenAPI document.",
        operationId: "getOpenApiSpec",
        responses: {
          "200": {
            description: "OpenAPI document.",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/api/openapi.json": {
      get: {
        tags: ["Metadata"],
        summary: "Get this OpenAPI document from the API namespace.",
        operationId: "getApiOpenApiSpec",
        responses: {
          "200": {
            description: "OpenAPI document.",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/docs": {
      get: {
        tags: ["Metadata"],
        summary: "View the Scalar API reference.",
        operationId: "getScalarDocs",
        responses: {
          "200": {
            description: "Scalar API reference HTML page.",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/docs": {
      get: {
        tags: ["Metadata"],
        summary: "View the Scalar API reference from the API namespace.",
        operationId: "getApiScalarDocs",
        responses: {
          "200": {
            description: "Scalar API reference HTML page.",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/config": {
      get: {
        tags: ["Metadata"],
        summary: "Get runtime feature flags for the app.",
        description: "Returns frontend feature availability derived from Worker configuration.",
        operationId: "getAppConfig",
        responses: {
          "200": {
            description: "Runtime app configuration.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConfigResponse" },
                examples: {
                  chatEnabled: {
                    summary: "Chat enabled",
                    value: { features: { chat: true } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/program": {
      get: {
        tags: ["Program"],
        summary: "List the full conference program.",
        description: "Returns the generated schedule payload used by the frontend, including day metadata, ranking metadata, and every program item.",
        operationId: "getProgram",
        responses: {
          "200": {
            description: "Program data.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgramResponse" },
                examples: {
                  registration: {
                    summary: "Program payload shape",
                    value: {
                      generatedAt: "2026-05-27T17:23:47.768Z",
                      days: {
                        main: [{ key: "mon", abbr: "Mon", date: "June 1" }],
                        all: [{ key: "mon", abbr: "Mon", date: "June 1" }],
                        labels: { mon: "Mon June 1" },
                      },
                      rankingMeta: {
                        model: "all-MiniLM-L6-v2",
                        netsciCount: 0,
                        namedVectors: [],
                        centroidCount: 0,
                        personVectorCount: 0,
                      },
                      items: [
                        {
                          id: "session:m-brk0",
                          sourceId: "m-brk0",
                          kind: "session",
                          title: "Registration & Coffee",
                          abstract: "",
                          type: "break",
                          dayKey: "mon",
                          dayLabel: "Mon June 1",
                          time: "8 AM - 9 AM",
                          startH: 8,
                          endH: 9,
                          room: "Amesbury Ballroom",
                          presenter: "",
                          chair: "",
                          authors: "",
                          url: "",
                          sessionId: "",
                          sessionTitle: "",
                          posterNum: null,
                          talkCount: 0,
                          ranking: null,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/item/{kind}/{id}": {
      get: {
        tags: ["Program"],
        summary: "Get a single program item.",
        description: [
          "Looks up one item by splitting its stable id into path parts.",
          "For example, the stable id `talk:51` is requested as `/api/item/talk/51`; `session:m-brk0` is requested as `/api/item/session/m-brk0`.",
          "The response includes the item, people connected to that item, and semantically related items.",
        ].join(" "),
        operationId: "getProgramItem",
        parameters: [
          {
            name: "kind",
            in: "path",
            required: true,
            schema: { $ref: "#/components/schemas/ProgramKind" },
            description: "Item kind prefix from the stable item id.",
            example: "talk",
          },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Source id portion of the item id. For item id talk:123, use 123.",
            example: "51",
          },
        ],
        responses: {
          "200": {
            description: "Program item detail.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ItemDetailResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/topics": {
      get: {
        tags: ["Topics"],
        summary: "List topic summaries.",
        description: "Returns embedding-derived topic clusters with a runtime `itemCount` showing how many items have that topic as their primary cluster.",
        operationId: "listTopics",
        responses: {
          "200": {
            description: "Topic summaries.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TopicsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/topics/{id}/items": {
      get: {
        tags: ["Topics"],
        summary: "List items in a topic.",
        description: "Returns the topic metadata plus program items whose primary embedding-derived topic matches the requested topic id. Items are ordered by topic score and then schedule/title tie-breakers.",
        operationId: "listTopicItems",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Numeric topic id from `/api/topics`.",
            example: 0,
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            description: "Maximum number of topic-item matches to return. Invalid or non-positive values fall back to 100.",
            example: 25,
          },
        ],
        responses: {
          "200": {
            description: "Topic and matching items.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TopicItemsResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/people": {
      get: {
        tags: ["People"],
        summary: "List people.",
        description: "Returns every person extracted from presenter, author, and chair fields, including their roles and associated item ids.",
        operationId: "listPeople",
        responses: {
          "200": {
            description: "People in the program.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PeopleResponse" },
              },
            },
          },
        },
      },
    },
    "/api/people/search": {
      get: {
        tags: ["People", "Search"],
        summary: "Search people by name.",
        description: "Fuzzy-searches names and roles. If `q` is empty, returns people with the most associated program items first.",
        operationId: "searchPeople",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string", default: "" },
            description: "Name or partial name to search for.",
            example: "Aarathi",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 12 },
            description: "Maximum number of people to return. Invalid or non-positive values fall back to 12.",
            example: 10,
          },
        ],
        responses: {
          "200": {
            description: "People search results.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PeopleSearchResponse" },
              },
            },
          },
        },
      },
    },
    "/api/people/by-topic": {
      get: {
        tags: ["People", "Search"],
        summary: "Find people connected to a topic.",
        description:
          "Searches program items by topical text, then aggregates presenters, authors, and chairs from matching items. Results are derived from program-item matches, not official expertise tags.",
        operationId: "findPeopleByTopic",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string", default: "" },
            description: "Topical phrase to search for.",
            example: "science of science",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            description: "Maximum number of people to return. Invalid or non-positive values fall back to 10.",
            example: 10,
          },
        ],
        responses: {
          "200": {
            description: "People ranked by matched topic evidence.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PeopleByTopicResponse" },
              },
            },
          },
        },
      },
    },
    "/api/people/{slug}": {
      get: {
        tags: ["People"],
        summary: "Get one person and their program items.",
        description: "Returns a person record and all program items linked from that person's `itemIds` array.",
        operationId: "getPerson",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "URL-safe person slug from `/api/people` or `/api/people/search`.",
            example: "aarathi-parameswaran",
          },
        ],
        responses: {
          "200": {
            description: "Person detail.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PersonDetailResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/related": {
      get: {
        tags: ["Program"],
        summary: "List items related to a program item.",
        description: "Returns semantically related items for a stable program item id. Relatedness comes from the bundled similarity data.",
        operationId: "listRelatedItems",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Stable item id in `kind:sourceId` format.",
            example: "talk:51",
          },
        ],
        responses: {
          "200": {
            description: "Related items.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RelatedResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "Search program items.",
        description: "Runs a lightweight lexical search across ids, titles, abstracts, session titles, item kinds/types, days, times, rooms, presenters, chairs, and authors. If `q` is empty, returns ranked recommendation items when available.",
        operationId: "searchProgramItems",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string", default: "" },
            description: "Program search query.",
            example: "coffee",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 12 },
            description: "Maximum number of search results to return. This route currently does not clamp very large values.",
            example: 12,
          },
        ],
        responses: {
          "200": {
            description: "Program search results.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgramSearchResponse" },
              },
            },
          },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Stream a chat response grounded in the program data.",
        description: [
          "Accepts AI SDK UI messages and streams a UI message response.",
          "The assistant answers from the bundled program data. The endpoint is available only when a Gemini API key is configured.",
          "Requests are rate-limited per connecting IP.",
        ].join(" "),
        operationId: "chat",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
              examples: {
                coffee: {
                  summary: "Ask about logistics",
                  value: {
                    messages: [
                      {
                        id: "msg-1",
                        role: "user",
                        parts: [{ type: "text", text: "When is coffee on Monday?" }],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "AI SDK UI message stream response.",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
                examples: {
                  stream: {
                    summary: "Streaming response",
                    value: "data: ...",
                  },
                },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded.",
            headers: {
              "Retry-After": {
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "503": {
            description: "Chat is disabled because Gemini is not configured.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    responses: {
      NotFound: {
        description: "Resource not found.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        description: "Standard JSON error body returned by API routes.",
        required: ["error"],
        properties: {
          error: { type: "string", example: "Item not found" },
        },
      },
      ProgramKind: {
        type: "string",
        description: "Top-level category encoded in a program item id.",
        enum: ["session", "talk", "poster"],
      },
      Ranking: {
        type: "object",
        description: "Recommendation ranking metadata for an item, when available.",
        required: ["rank", "score", "source", "topClusters"],
        properties: {
          rank: { type: "integer", description: "One-based rank within the recommendation set.", example: 1 },
          score: { type: "number", description: "Recommendation score from the similarity pipeline.", example: 0.84 },
          source: { type: "string", description: "Ranking source.", example: "similarity" },
          topClusters: {
            type: "array",
            description: "Highest-scoring topic clusters associated with this ranking.",
            items: {
              type: "object",
              required: ["clusterId", "score"],
              properties: {
                clusterId: { type: "string", example: "0" },
                score: { type: "number", example: 0.72 },
              },
            },
          },
        },
      },
      ProgramItem: {
        type: "object",
        description: "A session, talk, poster, break, meal, or other schedule item.",
        required: [
          "id",
          "sourceId",
          "kind",
          "title",
          "abstract",
          "type",
          "dayKey",
          "dayLabel",
          "time",
          "startH",
          "endH",
          "room",
          "presenter",
          "chair",
          "authors",
          "url",
          "sessionId",
          "sessionTitle",
          "posterNum",
          "ranking",
        ],
        properties: {
          id: { type: "string", description: "Stable item id in `kind:sourceId` format.", example: "session:m-brk0" },
          sourceId: { type: "string", description: "Source id without the kind prefix.", example: "m-brk0" },
          kind: { $ref: "#/components/schemas/ProgramKind" },
          title: { type: "string", description: "Display title.", example: "Registration & Coffee" },
          abstract: { type: "string", description: "Abstract text when available; otherwise an empty string." },
          type: { type: "string", description: "More specific program type from the extracted data.", example: "break" },
          dayKey: { type: "string", description: "Short day key used by frontend routes.", example: "mon" },
          dayLabel: { type: "string", description: "Human-readable day label.", example: "Mon June 1" },
          time: { type: "string", description: "Human-readable time range.", example: "8 AM - 9 AM" },
          startH: { type: ["number", "null"], description: "Start hour in 24-hour local conference time, or null if unknown.", example: 8 },
          endH: { type: ["number", "null"], description: "End hour in 24-hour local conference time, or null if unknown.", example: 9 },
          room: { type: "string", description: "Room or venue label. Empty string means no room was extracted.", example: "Amesbury Ballroom" },
          presenter: { type: "string", description: "Presenter text for talks or posters, if available." },
          chair: { type: "string", description: "Chair text for chaired sessions, if available." },
          authors: { type: "string", description: "Author list text, if available." },
          url: { type: "string", description: "Source URL if present in the extracted program data." },
          sessionId: { type: "string", description: "Parent session id for talks, if available." },
          sessionTitle: { type: "string", description: "Parent session title for talks, if available." },
          posterNum: { type: ["integer", "null"], description: "Poster number for posters, or null for non-poster items." },
          talkCount: { type: "integer", description: "Number of talks in this session, when the item is a session." },
          talkIndex: { type: ["integer", "null"], description: "One-based talk order within the session, when available." },
          ranking: {
            description: "Recommendation ranking metadata, or null if the item is not ranked.",
            anyOf: [{ $ref: "#/components/schemas/Ranking" }, { type: "null" }],
          },
        },
      },
      Person: {
        type: "object",
        description: "A person extracted from presenter, author, and chair fields.",
        required: ["id", "slug", "name", "roles", "itemIds", "embedding"],
        properties: {
          id: { type: "string", description: "Stable person id.", example: "person:aarathi-parameswaran" },
          slug: { type: "string", description: "URL-safe slug used by `/api/people/{slug}`.", example: "aarathi-parameswaran" },
          name: { type: "string", description: "Display name.", example: "Aarathi Parameswaran" },
          roles: {
            type: "array",
            description: "Roles observed for this person in the program.",
            example: ["presenter", "author"],
            items: { type: "string" },
          },
          itemIds: {
            type: "array",
            description: "Stable ids for program items linked to this person.",
            example: ["talk:471", "poster:471"],
            items: { type: "string" },
          },
          embedding: {
            description: "Embedding coverage metadata for this person, or null if no embedding was generated.",
            anyOf: [
              {
                type: "object",
                required: ["itemCount", "dimensions"],
                properties: {
                  itemCount: { type: "integer", example: 2 },
                  dimensions: { type: "integer", example: 512 },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
      RelatedPersonSummary: {
        type: "object",
        description: "Small person record embedded in item detail responses.",
        required: ["id", "slug", "name", "roles"],
        properties: {
          id: { type: "string", example: "person:aarathi-parameswaran" },
          slug: { type: "string", example: "aarathi-parameswaran" },
          name: { type: "string", example: "Aarathi Parameswaran" },
          roles: {
            type: "array",
            example: ["presenter", "author"],
            items: { type: "string" },
          },
        },
      },
      Cluster: {
        type: "object",
        description: "Embedding-derived topic cluster.",
        required: ["id", "label", "description", "size"],
        properties: {
          id: { type: "integer", example: 0 },
          label: { type: "string", example: "Science of science and collaboration" },
          description: {
            type: "string",
            example: "Research communities, collaboration structures, interdisciplinarity, and scientific careers.",
          },
          size: { type: "integer", description: "Cluster size from the similarity pipeline.", example: 41 },
        },
      },
      TopicSummary: {
        allOf: [
          { $ref: "#/components/schemas/Cluster" },
          {
            type: "object",
            required: ["itemCount"],
            properties: {
              itemCount: { type: "integer", description: "Number of items whose primary topic is this cluster.", example: 41 },
            },
          },
        ],
      },
      TopicItem: {
        type: "object",
        description: "Program item with its score for the requested topic.",
        required: ["item", "score"],
        properties: {
          item: { $ref: "#/components/schemas/ProgramItem" },
          score: { type: "number", description: "Topic assignment score for the item.", example: 0.91 },
        },
      },
      RelatedItem: {
        type: "object",
        description: "Program item with its semantic similarity score to another item.",
        required: ["item", "score"],
        properties: {
          item: { $ref: "#/components/schemas/ProgramItem" },
          score: { type: "number", description: "Similarity score from the related-item index.", example: 0.83 },
        },
      },
      SearchResult: {
        type: "object",
        description: "Program item with its lexical search score.",
        required: ["item", "score"],
        properties: {
          item: { $ref: "#/components/schemas/ProgramItem" },
          score: { type: "number", description: "Lexical relevance score. Larger values rank earlier.", example: 3 },
        },
      },
      CompactPerson: {
        type: "object",
        description: "Compact person record with an app path.",
        required: ["id", "slug", "name", "roles", "path"],
        properties: {
          id: { type: "string", example: "person:aarathi-parameswaran" },
          slug: { type: "string", example: "aarathi-parameswaran" },
          name: { type: "string", example: "Aarathi Parameswaran" },
          roles: {
            type: "array",
            example: ["presenter", "author"],
            items: { type: "string" },
          },
          path: { type: "string", description: "Frontend path for this person's page.", example: "/people/aarathi-parameswaran" },
        },
      },
      CompactProgramItem: {
        type: "object",
        description: "Compact program item summary used in chat and topic-person lookup results.",
        required: ["id", "title", "path", "kind", "type", "when", "room", "people", "peopleText"],
        properties: {
          id: { type: "string", example: "talk:123" },
          title: { type: "string", example: "Causal discovery of housing-mobility relations in urban residential migration networks" },
          path: { type: "string", description: "Frontend path for opening this item.", example: "/programs?item=talk:123" },
          kind: { $ref: "#/components/schemas/ProgramKind" },
          type: { type: "string", example: "parallel" },
          when: { type: "string", example: "Wed June 3 | 11 AM - 11:15 AM" },
          room: { type: "string", example: "Harvard Square A" },
          people: {
            type: "array",
            items: { $ref: "#/components/schemas/CompactPerson" },
          },
          peopleText: { type: "string", description: "Markdown linked people string.", example: "[Aarathi Parameswaran](/people/aarathi-parameswaran)" },
        },
      },
      PeopleByTopicResult: {
        type: "object",
        description: "A person ranked by topical matches in associated program items.",
        required: ["score", "person", "matchedItemCount", "items"],
        properties: {
          score: { type: "number", description: "Aggregate lexical score from matched program items. Larger values rank earlier.", example: 14 },
          person: { $ref: "#/components/schemas/CompactPerson" },
          matchedItemCount: { type: "integer", description: "Number of matched program items connected to this person.", example: 2 },
          items: {
            type: "array",
            description: "Top matched item summaries for this person.",
            items: { $ref: "#/components/schemas/CompactProgramItem" },
          },
        },
      },
      Days: {
        type: "object",
        description: "Day metadata used by the schedule views.",
        required: ["main", "all", "labels"],
        properties: {
          main: {
            type: "array",
            description: "Primary conference days shown in the main schedule navigation.",
            items: { $ref: "#/components/schemas/Day" },
          },
          all: {
            type: "array",
            description: "All extracted day entries, including any non-primary days.",
            items: { $ref: "#/components/schemas/Day" },
          },
          labels: {
            type: "object",
            description: "Map from day key to human-readable day label.",
            example: { mon: "Mon June 1" },
            additionalProperties: { type: "string" },
          },
        },
      },
      Day: {
        type: "object",
        description: "One day entry in the conference program.",
        required: ["key", "abbr", "date"],
        properties: {
          key: { type: "string", example: "mon" },
          abbr: { type: "string", example: "Mon" },
          date: { type: "string", example: "June 1" },
        },
      },
      RankingMeta: {
        type: "object",
        description: "Metadata for the recommendation and similarity data bundled with the app.",
        required: ["model", "netsciCount", "namedVectors", "centroidCount", "personVectorCount"],
        properties: {
          model: { type: "string", description: "Embedding model or pipeline model name.", example: "all-MiniLM-L6-v2" },
          netsciCount: { type: "integer", description: "Number of NetSci item vectors included in the similarity data." },
          namedVectors: {
            type: "array",
            description: "Named vectors used by optional ranking data.",
            items: { type: "string" },
          },
          centroidCount: { type: "integer", description: "Number of topic or cluster centroids." },
          personVectorCount: { type: "integer", description: "Number of generated person vectors." },
        },
      },
      ProgramResponse: {
        type: "object",
        description: "Full program payload served to the frontend.",
        required: ["generatedAt", "days", "rankingMeta", "items"],
        properties: {
          generatedAt: {
            type: "string",
            format: "date-time",
            description: "Timestamp when the bundled program data was generated.",
            example: "2026-05-27T17:23:47.768Z",
          },
          days: { $ref: "#/components/schemas/Days" },
          rankingMeta: { $ref: "#/components/schemas/RankingMeta" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ProgramItem" },
          },
        },
      },
      ItemDetailResponse: {
        type: "object",
        description: "Detail payload for one program item.",
        required: ["item", "people", "related"],
        properties: {
          item: { $ref: "#/components/schemas/ProgramItem" },
          people: {
            type: "array",
            items: { $ref: "#/components/schemas/RelatedPersonSummary" },
          },
          related: {
            type: "array",
            items: { $ref: "#/components/schemas/RelatedItem" },
          },
        },
      },
      TopicsResponse: {
        type: "object",
        description: "List of all topic summaries.",
        required: ["topics"],
        properties: {
          topics: {
            type: "array",
            items: { $ref: "#/components/schemas/TopicSummary" },
          },
        },
      },
      TopicItemsResponse: {
        type: "object",
        description: "Topic metadata plus items assigned to that topic.",
        required: ["topic", "items"],
        properties: {
          topic: { $ref: "#/components/schemas/Cluster" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/TopicItem" },
          },
        },
      },
      PeopleResponse: {
        type: "object",
        description: "List of all people extracted from the program.",
        required: ["people"],
        properties: {
          people: {
            type: "array",
            items: { $ref: "#/components/schemas/Person" },
          },
        },
      },
      PeopleSearchResponse: {
        type: "object",
        description: "Fuzzy people search response.",
        required: ["query", "results"],
        properties: {
          query: { type: "string", description: "Echo of the supplied `q` query parameter.", example: "Aarathi" },
          results: {
            type: "array",
            items: {
              type: "object",
              required: ["person", "score"],
              properties: {
                person: { $ref: "#/components/schemas/Person" },
                score: { type: "number", description: "Fuzzy-match score where larger is better.", example: 0.97 },
              },
            },
          },
        },
      },
      PeopleByTopicResponse: {
        type: "object",
        description: "People ranked by topical matches in the conference program.",
        required: ["query", "results"],
        properties: {
          query: { type: "string", description: "Echo of the supplied `q` query parameter.", example: "science of science" },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/PeopleByTopicResult" },
          },
        },
      },
      PersonDetailResponse: {
        type: "object",
        description: "One person and their associated program items.",
        required: ["person", "items"],
        properties: {
          person: { $ref: "#/components/schemas/Person" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ProgramItem" },
          },
        },
      },
      RelatedResponse: {
        type: "object",
        description: "Related-item lookup response.",
        required: ["item", "related"],
        properties: {
          item: { $ref: "#/components/schemas/ProgramItem" },
          related: {
            type: "array",
            items: { $ref: "#/components/schemas/RelatedItem" },
          },
        },
      },
      ProgramSearchResponse: {
        type: "object",
        description: "Lexical program search response.",
        required: ["query", "results"],
        properties: {
          query: { type: "string", description: "Echo of the supplied `q` query parameter.", example: "coffee" },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/SearchResult" },
          },
        },
      },
      ConfigResponse: {
        type: "object",
        description: "Runtime feature flags for the frontend.",
        required: ["features"],
        properties: {
          features: {
            type: "object",
            required: ["chat"],
            properties: {
              chat: {
                type: "boolean",
                description: "Whether Gemini-backed chat is configured and should be shown as available.",
              },
            },
          },
        },
      },
      ChatRequest: {
        type: "object",
        description: "AI SDK UI message request body accepted by the chat endpoint.",
        required: ["messages"],
        properties: {
          messages: {
            type: "array",
            description: "Conversation messages in AI SDK UI message format.",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                id: { type: "string", description: "Client-generated message id.", example: "msg-1" },
                role: { type: "string", enum: ["system", "user", "assistant", "data"], example: "user" },
                parts: {
                  type: "array",
                  description: "Message parts. Text parts use `{ type: \"text\", text: \"...\" }`.",
                  items: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
