import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useState } from "react";
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

const EXAMPLES = [
  "What kind of topics are there?",
  "Are there talks on GNNs?",
  "Find presentations by a speaker.",
  "Suggest items related to temporal networks.",
];

function ChatConversation({
  messages,
  status,
  onExample,
}: {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
  onExample: (text: string) => void;
}) {
  if (messages.length === 0) {
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
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const [input, setInput] = useState("");

  function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status !== "ready") return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitText(input);
  }

  return (
    <div className="chatPane">
      <Conversation>
        <ChatConversation messages={messages} status={status} onExample={submitText} />
      </Conversation>
      {error && <div className="chatError">{error.message}</div>}
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
