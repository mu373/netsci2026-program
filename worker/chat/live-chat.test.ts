import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { describe, expect, test } from "vitest";
import { chatTools } from "./tools";
import { normalizeSavedItems, systemPromptForChat } from "./prompt";
import { itemById } from "../program";
import type { UIMessage } from "ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const runLiveTests = process.env.RUN_LIVE_CHAT_TESTS === "1" && Boolean(apiKey);
const liveDescribe = runLiveTests ? describe : describe.skip;

type ChatShape = {
  text: string;
  toolCalls: { toolName: string; input: unknown }[];
  toolResults: { toolName: string; output: unknown }[];
};

function userMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

async function runChat(query: string): Promise<ChatShape> {
  const google = createGoogleGenerativeAI({ apiKey });
  const messages = [userMessage(query)];
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPromptForChat(query, normalizeSavedItems([])),
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(4),
    temperature: 0,
  });

  const shape: ChatShape = {
    text: "",
    toolCalls: [],
    toolResults: [],
  };

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      shape.text += part.text;
    } else if (part.type === "tool-call") {
      shape.toolCalls.push({ toolName: part.toolName, input: part.input });
    } else if (part.type === "tool-result") {
      shape.toolResults.push({ toolName: part.toolName, output: part.output });
    }
  }

  return shape;
}

function recommendationOutput(shape: ChatShape) {
  return shape.toolResults.find((result) => result.toolName === "showProgramRecommendations")
    ?.output as
    | {
        kind?: unknown;
        items?: unknown;
      }
    | undefined;
}

function recommendationItems(output: unknown) {
  if (!output || typeof output !== "object") return [];
  const items = (output as { items?: unknown }).items;
  return Array.isArray(items) ? items : [];
}

liveDescribe("live Gemini chat behavior", () => {
  test("program-item answers use structured recommendation cards without raw JSON", async () => {
    const shape = await runChat("Are there talks on GNNs?");
    const output = recommendationOutput(shape);
    const items = recommendationItems(output);

    expect(output?.kind).toBe("program_recommendations");
    expect(items.length).toBeGreaterThan(0);
    expect(shape.text).not.toContain("program_recommendations");
    expect(shape.text).not.toMatch(/"items"\s*:/);

    for (const item of items) {
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          summary: expect.any(String),
        }),
      );
      expect(itemById.has((item as { id: string }).id)).toBe(true);
      expect((item as { summary: string }).summary.trim().length).toBeGreaterThan(20);
    }
  });

  test("person presentation answers use structured recommendation cards", async () => {
    const shape = await runChat("Find presentations by Esteban Moro");
    const output = recommendationOutput(shape);
    const items = recommendationItems(output);

    expect(output?.kind).toBe("program_recommendations");
    expect(items.length).toBeGreaterThan(0);
    expect(shape.text).not.toContain("program_recommendations");
    expect(items.every((item) => itemById.has((item as { id: string }).id))).toBe(true);
  });

  test("people-by-topic answers stay as markdown people links, not cards", async () => {
    const shape = await runChat("Who works on science of science?");

    expect(shape.toolCalls.some((call) => call.toolName === "findPeopleByTopic")).toBe(true);
    expect(shape.toolResults.some((result) => result.toolName === "showProgramRecommendations")).toBe(false);
    expect(shape.text).toContain("- ");
    expect(shape.text).toContain("](/people/");
  });
});
