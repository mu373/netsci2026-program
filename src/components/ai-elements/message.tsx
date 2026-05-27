import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { Response } from "./response";

function textFromParts(parts: UIMessage["parts"]) {
  return parts.map((part) => (part.type === "text" ? part.text : "")).join("");
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
  if (message.role === "assistant") return <Response>{text}</Response>;
  return <span>{text}</span>;
}
