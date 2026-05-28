export const openApiSearchPaths = {
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
} as const;
