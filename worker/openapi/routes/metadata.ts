export const openApiMetadataPaths = {
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
} as const;
