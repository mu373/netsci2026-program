export const openApiPeopleSchemas = {
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
} as const;
