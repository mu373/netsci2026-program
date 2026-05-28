import { describe, expect, test } from "vitest";
import {
  formatChatMarkdown,
  looksLikeRecommendationJson,
  parseProgramRecommendations,
  resolveRecommendationId,
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
