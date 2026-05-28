export const openApiTopicPaths = {
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
} as const;
