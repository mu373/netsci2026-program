export const openApiDiscoverySchemas = {
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
} as const;
