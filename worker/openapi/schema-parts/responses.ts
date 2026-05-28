export const openApiResponseSchemas = {
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
} as const;
