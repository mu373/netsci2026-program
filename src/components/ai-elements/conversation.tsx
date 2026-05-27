import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Conversation({ children }: { children: ReactNode }) {
  return <div className="conversationShell">{children}</div>;
}

export function ConversationContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (atBottom) ref.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [children, atBottom]);

  return (
    <div
      ref={ref}
      className="conversation"
      onScroll={(event) => {
        const target = event.currentTarget;
        setAtBottom(target.scrollHeight - target.scrollTop - target.clientHeight < 40);
      }}
    >
      {children}
    </div>
  );
}

export function ConversationEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="chatEmpty">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ConversationScrollButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="conversationScrollBtn" onClick={onClick} title="Scroll to bottom">
      <ArrowDown size={14} />
    </button>
  );
}
