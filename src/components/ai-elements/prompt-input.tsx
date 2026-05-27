import { Send, Square } from "lucide-react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";

export function PromptInput({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="promptInput" onSubmit={onSubmit}>
      {children}
    </form>
  );
}

export function PromptInputBody({ children }: { children: ReactNode }) {
  return <div className="promptInputBody">{children}</div>;
}

export function PromptInputFooter({ children }: { children: ReactNode }) {
  return <div className="promptInputFooter">{children}</div>;
}

export function PromptInputTools({ children }: { children?: ReactNode }) {
  return <div className="promptInputTools">{children}</div>;
}

export function PromptInputButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button className="promptInputButton" type="button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function PromptInputTextarea({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      placeholder={placeholder}
      rows={1}
    />
  );
}

export function PromptInputSubmit({
  status,
  disabled,
  onStop,
}: {
  status: "submitted" | "streaming" | "ready" | "error";
  disabled?: boolean;
  onStop: () => void;
}) {
  const busy = status === "submitted" || status === "streaming";
  return busy ? (
    <button type="button" className="promptButton" onClick={onStop} title="Stop">
      <Square size={15} />
    </button>
  ) : (
    <button type="submit" className="promptButton primary" disabled={disabled} title="Send">
      <Send size={15} />
    </button>
  );
}
