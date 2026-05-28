import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarDays, MapPin, UserRound } from "lucide-react";
import {
  cleanRecommendationSummary,
  displayItemTitle,
  formatChatMarkdown,
  itemMeta,
  localItemSummary,
  looksLikeRecommendationJson,
  parseProgramRecommendations,
  parseProgramReferenceList,
  pathForItem,
} from "../../lib/chatResponse";
import { pushUrl, rememberDetailReturn, scrollPageToTop } from "../../lib/navigation";
import type { MouseEvent } from "react";
import type { ProgramRecommendationPayload } from "../../lib/chatResponse";
import type { ProgramItem } from "../../types";

function openPath(path: string) {
  const url = new URL(path, window.location.origin);
  if (location.pathname === "/chat" && url.searchParams.has("item")) {
    const params = new URLSearchParams();
    rememberDetailReturn("chat");
    params.set("item", url.searchParams.get("item") || "");
    params.set("returnTo", "chat");
    pushUrl("/chat", params);
    return;
  }
  if (location.pathname === "/chat" && url.pathname.startsWith("/people/")) {
    url.searchParams.set("returnTo", "chat");
  }
  pushUrl(url.pathname, url.searchParams);
  scrollPageToTop();
}

function openInternalLink(event: MouseEvent<HTMLAnchorElement>, href: string | undefined) {
  if (!href?.startsWith("/") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openPath(href);
}

function ProgramRecommendationCards({ payload }: { payload: ProgramRecommendationPayload }) {
  const [itemById, setItemById] = useState<Map<string, ProgramItem> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("../../data").then((module) => {
      if (!cancelled) setItemById(module.itemById);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!itemById) return <div className="notice">Loading recommendations...</div>;

  return (
    <div className="programRecommendations">
      {payload.intro && <p className="recommendationIntro">{payload.intro}</p>}
      <div className="recommendationList">
        {payload.items.map((entry) => {
          const item = itemById.get(entry.id);
          if (!item) return null;
          const path = pathForItem(item);
          const meta = itemMeta(item);
          const summary = cleanRecommendationSummary(entry.summary || "", item) || localItemSummary(item);
          return (
            <button
              type="button"
              key={entry.id}
              className="recommendationCard"
              onClick={() => openPath(path)}
            >
              <span className="recommendationTitle">{displayItemTitle(item)}</span>
              <span className="recommendationMeta">
                <span>
                  <CalendarDays size={12} aria-hidden="true" />
                  {meta.when}
                </span>
                <span>
                  <MapPin size={12} aria-hidden="true" />
                  {meta.where}
                </span>
                <span>
                  <UserRound size={12} aria-hidden="true" />
                  {meta.presenter}
                </span>
              </span>
              {summary && <span className="recommendationSummary">{summary}</span>}
            </button>
          );
        })}
      </div>
      {payload.outro && <p className="recommendationOutro">{payload.outro}</p>}
    </div>
  );
}

export function Response({ children }: { children: string }) {
  const recommendations = parseProgramRecommendations(children) ?? parseProgramReferenceList(children);
  if (recommendations) return <ProgramRecommendationCards payload={recommendations} />;
  if (looksLikeRecommendationJson(children)) {
    return null;
  }

  return (
    <div className="aiResponse">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              onClick={(event) => openInternalLink(event, href)}
              target={href?.startsWith("/") ? undefined : "_blank"}
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const inline = !className;
            return inline ? <code>{children}</code> : <code className={className}>{children}</code>;
          },
        }}
      >
        {formatChatMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
