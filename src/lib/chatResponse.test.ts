import { describe, expect, test } from "vitest";
import {
  coerceProgramRecommendations,
  formatChatMarkdown,
  looksLikeRecommendationJson,
  parseProgramRecommendations,
  resolveRecommendationId,
  stripProgramRecommendationJson,
  structuredRecommendationIntroText,
} from "./chatResponse";

describe("parseProgramRecommendations", () => {
  test("parses a recommendation payload embedded after prose", () => {
    const payload = parseProgramRecommendations(`And here is a presentation by [Esteban Nocet-Binois](/people/esteban-nocet-binois):

{"kind":"program_recommendations","intro":"","items":[{"id":"talk:581","summary":"This talk focuses on separating spatial and noise structures within network processes."}]}`);

    expect(payload).toEqual({
      kind: "program_recommendations",
      intro: "",
      items: [
        {
          id: "talk:581",
          summary:
            "This talk focuses on separating spatial and noise structures within network processes.",
        },
      ],
      outro: "",
    });
  });

  test("preserves markdown text in intro and outro", () => {
    const payload = parseProgramRecommendations(
      JSON.stringify({
        kind: "program_recommendations",
        intro: "Here are the presentations by [Esteban Moro](/people/esteban-moro):",
        items: [{ id: "talk:123", summary: "Uses mobility data to study urban systems." }],
        outro: "Open [People](/people) for more presenters.",
      }),
    );

    expect(payload?.intro).toBe(
      "Here are the presentations by [Esteban Moro](/people/esteban-moro):",
    );
    expect(payload?.outro).toBe("Open [People](/people) for more presenters.");
  });

  test("handles braces inside JSON strings", () => {
    const payload = parseProgramRecommendations(
      '{"kind":"program_recommendations","items":[{"id":"poster:42","summary":"Compares {structured} perturbations with baseline noise."}]}',
    );

    expect(payload?.items).toEqual([
      {
        id: "poster:42",
        summary: "Compares {structured} perturbations with baseline noise.",
      },
    ]);
  });

  test("rejects items-only JSON without the recommendation kind", () => {
    expect(parseProgramRecommendations('{"items":[{"id":"talk:581","summary":"Valid item."}]}')).toBeNull();
  });
});

describe("coerceProgramRecommendations", () => {
  test("normalizes structured tool output", () => {
    expect(
      coerceProgramRecommendations({
        kind: "program_recommendations",
        intro: "Related sessions:",
        items: [{ id: "/programs?item=talk%3A581", summary: "Separates topology-driven dynamics from structured random forcing." }],
      }),
    ).toEqual({
      kind: "program_recommendations",
      intro: "Related sessions:",
      items: [
        {
          id: "talk:581",
          summary: "Separates topology-driven dynamics from structured random forcing.",
        },
      ],
      outro: "",
    });
  });
});

describe("stripProgramRecommendationJson", () => {
  test("removes printed recommendation JSON while preserving prose", () => {
    expect(
      stripProgramRecommendationJson(`Here are related talks:

{"kind":"program_recommendations","items":[{"id":"talk:581","summary":"Separates spatial operators from noise structure."}]}`),
    ).toBe("Here are related talks:");
  });
});

describe("structuredRecommendationIntroText", () => {
  test("keeps only the first intro line when structured cards are available", () => {
    expect(
      structuredRecommendationIntroText(`I found these talks on GNNs: I found these talks on GNNs:

The Self-Loop Paradox: Investigating the Impact of Self-loops on GNNs
This talk investigates the impact of self-loops on Graph Neural Networks.

Epidemic Source Detection as a New Benchmark Task for Evaluating GNNs
This talk proposes using epidemic source detection as a benchmark task.

Would you like to know more about any of these talks?`),
    ).toBe("I found these talks on GNNs:");
  });
});

describe("looksLikeRecommendationJson", () => {
  test("flags partial recommendation JSON during streaming", () => {
    expect(
      looksLikeRecommendationJson(
        "Here are the presentations by [Esteban Moro](/people/esteban-moro):\n\n{",
      ),
    ).toBe(true);
  });
});

describe("resolveRecommendationId", () => {
  test("resolves item ids from internal item paths", () => {
    expect(resolveRecommendationId("/programs?item=talk%3A581")).toBe("talk:581");
    expect(resolveRecommendationId("/day/wed?item=poster%3A42&returnTo=chat")).toBe("poster:42");
  });
});

describe("formatChatMarkdown", () => {
  test("linkifies bare local paths", () => {
    expect(formatChatMarkdown("Open /people/esteban-moro for details.")).toBe(
      "Open [/people/esteban-moro](/people/esteban-moro) for details.",
    );
  });
});
