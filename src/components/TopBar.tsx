import { CalendarDays, ListFilter, MessageCircle, Users } from "lucide-react";
import { defaultDayKey, pushUrl, scrollPageToTop } from "../lib/navigation";
import type { Route } from "../lib/navigation";
import { PEOPLE_LIST_SCROLL_KEY } from "../lib/scrollPositions";

export function TopBar({
  route,
  chatEnabled,
  onResetChat,
}: {
  route: Route;
  chatEnabled: boolean;
  onResetChat: () => void;
}) {
  function gotoTab(path: string) {
    pushUrl(path);
  }

  return (
    <header className="topBar">
      <div className="brand">
        <strong>NetSci 2026</strong>
        <span>Unofficial Guide</span>
      </div>

      <nav className="mainTabs">
        <button
          className={route.name === "calendar" ? "tabBtn active" : "tabBtn"}
          onClick={() => gotoTab(`/day/${route.name === "calendar" ? route.dayKey : defaultDayKey()}`)}
        >
          <CalendarDays size={14} /> Calendar
        </button>
        <button
          className={route.name === "programs" ? "tabBtn active" : "tabBtn"}
          onClick={() => gotoTab("/programs")}
        >
          <ListFilter size={14} /> Programs
        </button>
        <button
          className={route.name === "people" ? "tabBtn active" : "tabBtn"}
          onClick={() => {
            sessionStorage.removeItem(PEOPLE_LIST_SCROLL_KEY);
            gotoTab("/people");
            scrollPageToTop();
          }}
        >
          <Users size={14} /> People
        </button>
        <button
          className={route.name === "chat" ? "tabBtn active" : "tabBtn"}
          disabled={!chatEnabled}
          title={chatEnabled ? "Chat" : "Chat requires Gemini configuration"}
          onClick={() => {
            if (!chatEnabled) return;
            if (route.name === "chat") onResetChat();
            gotoTab("/chat");
            scrollPageToTop();
          }}
        >
          <MessageCircle size={14} /> Chat
        </button>
      </nav>
    </header>
  );
}
