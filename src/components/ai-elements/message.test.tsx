/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MessageResponse } from "./message";
import type { ProgramItem } from "../../types";

const recommendedTalk: ProgramItem = {
  id: "talk:581",
  sourceId: "581",
  kind: "talk",
  title: "Disentangling Spatial and Noise Structures in Network Processes",
  abstract: "Separates deterministic dynamics from structured random forcing.",
  type: "parallel",
  dayKey: "fri",
  dayLabel: "Fri June 5",
  time: "5:15 PM",
  startH: 17.25,
  endH: null,
  room: "Kendall Square",
  presenter: "Esteban Nocet-Binois",
  chair: "",
  authors: "Nocet-Binois, Esteban*; Hackl, Jurgen",
  url: "",
  sessionId: "f-ps310",
  sessionTitle: "PS 3.10 - Statistical Inference",
  posterNum: null,
  ranking: null,
};

vi.mock("../../data", () => ({
  itemById: new Map([[recommendedTalk.id, recommendedTalk]]),
}));

afterEach(() => {
  cleanup();
});

describe("MessageResponse", () => {
  test("renders structured recommendation cards without duplicated streamed prose", async () => {
    const streamedText = `I found these talks on GNNs: I found these talks on GNNs:

The Self-Loop Paradox: Investigating the Impact of Self-loops on GNNs
This talk investigates the impact of self-loops on Graph Neural Networks (GNNs) and how they affect predictions.

Epidemic Source Detection as a New Benchmark Task for Evaluating GNNs
This talk proposes using epidemic source detection as a benchmark task for evaluating Graph Neural Networks (GNNs).

Would you like to know more about any of these talks or find related people?`;

    const message = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: streamedText },
        {
          type: "tool-showProgramRecommendations",
          state: "output-available",
          toolCallId: "call-1",
          output: {
            kind: "program_recommendations",
            intro: "",
            items: [
              {
                id: "talk:581",
                summary: "Separates spatial operators from structured noise in network processes.",
              },
            ],
            outro: "",
          },
        },
      ],
    } as unknown as UIMessage;

    render(<MessageResponse message={message} />);

    expect(screen.getByText("I found these talks on GNNs:")).toBeTruthy();
    expect(
      screen.queryByText("The Self-Loop Paradox: Investigating the Impact of Self-loops on GNNs"),
    ).toBeNull();
    expect(screen.queryByText(/Would you like to know more/)).toBeNull();

    expect(
      await screen.findByText("Disentangling Spatial and Noise Structures in Network Processes"),
    ).toBeTruthy();
    expect(
      screen.getByText("Separates spatial operators from structured noise in network processes."),
    ).toBeTruthy();
  });
});
