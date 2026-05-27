import type { ReactNode } from "react";

export function Suggestions({ children }: { children: ReactNode }) {
  return <div className="suggestions">{children}</div>;
}

export function Suggestion({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="suggestion" onClick={onClick}>
      {children}
    </button>
  );
}
