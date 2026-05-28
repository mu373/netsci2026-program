export const openApiScheduleSchemas = {
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
} as const;
