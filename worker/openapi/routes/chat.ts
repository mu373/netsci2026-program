export const openApiChatPaths = {
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
} as const;
