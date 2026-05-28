export const openApiProgramPaths = {
    "/api/program": {
      get: {
        tags: ["Program"],
        summary: "List the full conference program.",
        description: "Returns the generated schedule payload used by the frontend, including day metadata, ranking metadata, and every program item.",
        operationId: "getProgram",
        responses: {
          "200": {
            description: "Program data.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProgramResponse" },
                examples: {
                  registration: {
                    summary: "Program payload shape",
                    value: {
                      generatedAt: "2026-05-27T17:23:47.768Z",
                      days: {
                        main: [{ key: "mon", abbr: "Mon", date: "June 1" }],
                        all: [{ key: "mon", abbr: "Mon", date: "June 1" }],
                        labels: { mon: "Mon June 1" },
                      },
                      rankingMeta: {
                        model: "all-MiniLM-L6-v2",
                        netsciCount: 0,
                        namedVectors: [],
                        centroidCount: 0,
                        personVectorCount: 0,
                      },
                      items: [
                        {
                          id: "session:m-brk0",
                          sourceId: "m-brk0",
                          kind: "session",
                          title: "Registration & Coffee",
                          abstract: "",
                          type: "break",
                          dayKey: "mon",
                          dayLabel: "Mon June 1",
                          time: "8 AM - 9 AM",
                          startH: 8,
                          endH: 9,
                          room: "Amesbury Ballroom",
                          presenter: "",
                          chair: "",
                          authors: "",
                          url: "",
                          sessionId: "",
                          sessionTitle: "",
                          posterNum: null,
                          talkCount: 0,
                          ranking: null,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/item/{kind}/{id}": {
      get: {
        tags: ["Program"],
        summary: "Get a single program item.",
        description: [
          "Looks up one item by splitting its stable id into path parts.",
          "For example, the stable id `talk:51` is requested as `/api/item/talk/51`; `session:m-brk0` is requested as `/api/item/session/m-brk0`.",
          "The response includes the item, people connected to that item, and semantically related items.",
        ].join(" "),
        operationId: "getProgramItem",
        parameters: [
          {
            name: "kind",
            in: "path",
            required: true,
            schema: { $ref: "#/components/schemas/ProgramKind" },
            description: "Item kind prefix from the stable item id.",
            example: "talk",
          },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Source id portion of the item id. For item id talk:123, use 123.",
            example: "51",
          },
        ],
        responses: {
          "200": {
            description: "Program item detail.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ItemDetailResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
} as const;
