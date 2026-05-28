import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "./ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "./ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./ai-elements/prompt-input";
import { Suggestion, Suggestions } from "./ai-elements/suggestion";

type MessageSource = "template" | "freeform";

const CHAT_SESSION_STORAGE_KEY = "netsci2026:chat-session-id";

const EXAMPLES = [
  "What kind of topics are there?",
  "Who works on science of science?",
  "Are there talks on GNNs?",
  "Find presentations by a speaker.",
  "Suggest items related to temporal networks.",
];

const KEYBOARD_INSET_THRESHOLD = 80;

function useKeyboardAwarePrompt() {
  useEffect(() => {
    const root = document.documentElement;
    const updateTimers = new Set<number>();

    const updateViewportVars = () => {
      const viewport = window.visualViewport;
      const focusedElement = document.activeElement;
      const promptFocused =
        focusedElement instanceof HTMLElement && Boolean(focusedElement.closest(".promptInput"));

      if (!viewport) {
        root.style.setProperty("--chat-keyboard-inset", "0px");
        return;
      }

      const layoutOverlap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      const keyboardInset = layoutOverlap;
      const activeInset =
        promptFocused || keyboardInset > KEYBOARD_INSET_THRESHOLD ? keyboardInset : 0;

      root.style.setProperty("--chat-viewport-height", `${Math.round(viewport.height)}px`);
      root.style.setProperty("--chat-keyboard-inset", `${Math.round(activeInset)}px`);
    };

    const scheduleUpdate = () => {
      updateViewportVars();
      [40, 140, 320].forEach((delay) => {
        const timer = window.setTimeout(() => {
          updateTimers.delete(timer);
          updateViewportVars();
        }, delay);
        updateTimers.add(timer);
      });
    };

    updateViewportVars();

    window.addEventListener("resize", updateViewportVars);
    window.addEventListener("focusin", scheduleUpdate);
    window.addEventListener("focusout", scheduleUpdate);
    document.addEventListener("input", scheduleUpdate, true);
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);

    return () => {
      updateTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("focusin", scheduleUpdate);
      window.removeEventListener("focusout", scheduleUpdate);
      document.removeEventListener("input", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      root.style.removeProperty("--chat-keyboard-inset");
      root.style.removeProperty("--chat-viewport-height");
    };
  }, []);
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getChatSessionId() {
  const fallback = makeSessionId();

  try {
    const stored = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (stored) return stored;

    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, fallback);
  } catch {
    return fallback;
  }

  return fallback;
}

function chatErrorMessage(error: Error) {
  const raw = error.message.trim();
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { error?: unknown; message?: unknown };
      const message = parsed.error ?? parsed.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      // Fall back to the SDK error text below.
    }
  }
  return raw || "Something went wrong. Try again in a moment.";
}

function ChatConversation({
  messages,
  status,
  error,
  onExample,
}: {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
  error: ReturnType<typeof useChat>["error"];
  onExample: (text: string) => void;
}) {
  if (messages.length === 0 && !error) {
    return (
      <ConversationEmptyState
        title="Ask about the program"
        description="Find talks, people, topics, logistics, and related sessions."
      >
        <Suggestions>
          {EXAMPLES.map((example) => (
            <Suggestion key={example} onClick={() => onExample(example)}>
              {example}
            </Suggestion>
          ))}
        </Suggestions>
      </ConversationEmptyState>
    );
  }

  return (
    <ConversationContent>
      {messages.map((message) => (
        <Message key={message.id} from={message.role}>
          <MessageContent>
            <MessageResponse message={message} />
          </MessageContent>
        </Message>
      ))}
      {status === "submitted" && (
        <Message from="assistant">
          <MessageContent>
            <span className="muted">Thinking...</span>
          </MessageContent>
        </Message>
      )}
      {error && (
        <Message from="assistant">
          <MessageContent>
            <span>{chatErrorMessage(error)}</span>
          </MessageContent>
        </Message>
      )}
    </ConversationContent>
  );
}

function ChatPromptInput({
  input,
  status,
  onInput,
  onSubmit,
  onStop,
}: {
  input: string;
  status: ReturnType<typeof useChat>["status"];
  onInput: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStop: () => void;
}) {
  return (
    <PromptInput onSubmit={onSubmit}>
      <PromptInputBody>
        <PromptInputTextarea
          value={input}
          onChange={onInput}
          placeholder="Ask about talks, people, or topics..."
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputSubmit status={status} disabled={!input.trim()} onStop={onStop} />
      </PromptInputFooter>
    </PromptInput>
  );
}

export function ChatPage() {
  useKeyboardAwarePrompt();

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const [sessionId] = useState(getChatSessionId);
  const [input, setInput] = useState("");

  function submitText(text: string, messageSource: MessageSource = "freeform") {
    const trimmed = text.trim();
    if (!trimmed || status !== "ready") return;
    sendMessage(
      { text: trimmed },
      {
        body: {
          sessionId,
          messageSource,
        },
      },
    );
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitText(input);
  }

  return (
    <div className="chatPane">
      <Conversation>
        <ChatConversation
          messages={messages}
          status={status}
          error={error}
          onExample={(example) => submitText(example, "template")}
        />
      </Conversation>
      <ChatPromptInput
        input={input}
        status={status}
        onInput={setInput}
        onSubmit={onSubmit}
        onStop={stop}
      />
    </div>
  );
}
