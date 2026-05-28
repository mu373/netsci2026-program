import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import type { ProgramRecommendationPayload } from "../../lib/chatResponse";
import { coerceProgramRecommendations, structuredRecommendationIntroText } from "../../lib/chatResponse";
import { ProgramRecommendationCards, Response } from "./response";

function textFromParts(parts: UIMessage["parts"]) {
  return parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function programRecommendationPayloads(parts: UIMessage["parts"]): ProgramRecommendationPayload[] {
  return parts
    .map((part) => {
      if (part.type !== "tool-showProgramRecommendations") return null;
      if (!("state" in part) || part.state !== "output-available") return null;
      if (!("output" in part)) return null;
      return coerceProgramRecommendations(part.output);
    })
    .filter((payload): payload is ProgramRecommendationPayload => Boolean(payload));
}

export function Message({
  from,
  children,
}: {
  from: "user" | "assistant" | "system";
  children: ReactNode;
}) {
  return <div className={`chatMessage ${from}`}>{children}</div>;
}

export function MessageContent({ children }: { children: ReactNode }) {
  return <div className="messageBubble">{children}</div>;
}

export function MessageAvatar({ label }: { label: string }) {
  return <div className="messageRole">{label}</div>;
}

export function MessageResponse({ message }: { message: UIMessage }) {
  const text = textFromParts(message.parts);
  if (message.role === "assistant") {
    const recommendations = programRecommendationPayloads(message.parts);
    const displayText = recommendations.length ? structuredRecommendationIntroText(text) : text;
    return (
      <>
        {displayText && <Response>{displayText}</Response>}
        {recommendations.map((payload, index) => (
          <ProgramRecommendationCards key={index} payload={payload} />
        ))}
      </>
    );
  }
  return <span>{text}</span>;
}
