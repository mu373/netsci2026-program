export const openApiCompactSchemas = {
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
} as const;
