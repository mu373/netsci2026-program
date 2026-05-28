export const openApiPeoplePaths = {
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
} as const;
