import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiDocsPage } from "./components/ApiDocsPage";
import { CalendarPage } from "./components/CalendarPage";
import { ChatPage } from "./components/ChatPage";
import { DetailDrawer } from "./components/DetailDrawer";
import { PeoplePage } from "./components/PeoplePage";
import { ProgramsPage } from "./components/ProgramsPage";
import { TopBar } from "./components/TopBar";
import { useIsMobile } from "./hooks/useIsMobile";
import { analyticsEnabled, trackPageView } from "./lib/analytics";
import { defaultDayKey, pushUrl, useRoute } from "./lib/navigation";
import { useSavedItems } from "./useSavedItems";

type AppConfig = {
  features?: {
    chat?: boolean;
  };
};

function AppFooter({ onAbout, onPrivacy }: { onAbout: () => void; onPrivacy: () => void }) {
  return (
    <footer className="appFooter">
      <div className="footerActions">
        <button className="footerLink" type="button" onClick={onAbout}>
          About
        </button>
        <button className="footerLink" type="button" onClick={onPrivacy}>
          Privacy notice
        </button>
      </div>
      <span>
        Built from the{" "}
        <a className="footerLink" href="https://program.netsci2026.com/" target="_blank" rel="noreferrer">
          official program
        </a>
        . Please check the source for final details.
      </span>
    </footer>
  );
}

function PrivacyNoticeDialog({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="aboutBackdrop" onClick={onClose} />
      <section className="aboutDialog privacyDialog" role="dialog" aria-modal="true" aria-label="Privacy notice">
        <h2>Privacy Notice</h2>
        <p>
          This site includes an experimental AI chat feature. When you send a chat message, we may store the
          message, timestamp, anonymous browser session ID, referrer, approximate country, browser user agent,
          and Cloudflare request ID. Do not include sensitive personal information in chat messages.
        </p>
        <p>
          We use this information to review messages, improve the content, debug issues, and prevent abuse.
          Chat records are stored in Cloudflare infrastructure and are not sold or used for advertising.
        </p>
        {analyticsEnabled && (
          <p>
            This site uses Google Analytics to help understand aggregate site usage. Google Analytics may use
            cookies or similar identifiers to collect information about visits, such as pages viewed,
            approximate location, browser and device information, and interactions with the site. Google
            explains how it uses information from sites that use its services at{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
              policies.google.com/technologies/partner-sites
            </a>
            .
          </p>
        )}
        <p>
          The chat may generate incomplete or inaccurate responses and should not be relied on as professional,
          medical, legal, or policy advice.
        </p>
        <button className="drawerLink" type="button" onClick={onClose}>
          Close
        </button>
      </section>
    </>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="aboutBackdrop" onClick={onClose} />
      <section className="aboutDialog" role="dialog" aria-modal="true" aria-label="About this guide">
        <h2>About This Guide</h2>
        <p>
          This unofficial guide is built from the{" "}
          <a href="https://program.netsci2026.com/" target="_blank" rel="noreferrer">
            NetSci 2026 official program
          </a>{" "}
          to make browsing, searching, saving, and calendar export easier.
        </p>
        <p>
          Topic labels and related items are generated from program-item embeddings, so they are
          discovery aids rather than official conference tracks.
        </p>
        <p>Please check the official source for final times, rooms, and program details.</p>
        <button className="drawerLink" type="button" onClick={onClose}>
          Close
        </button>
      </section>
    </>
  );
}

export default function App() {
  const { route, params } = useRoute();
  const saved = useSavedItems();
  const savedOnly = params.get("saved") === "1";
  const openItemId = params.get("item");
  const isMobile = useIsMobile();
  const inlineDetail = !isMobile && route.name === "programs" && !!openItemId;
  const [chatResetKey, setChatResetKey] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    trackPageView();
  }, [route, params]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((config: AppConfig) => {
        if (!cancelled) setChatEnabled(config.features?.chat === true);
      })
      .catch(() => {
        if (!cancelled) setChatEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (chatEnabled === false && route.name === "chat") {
      pushUrl(`/day/${defaultDayKey()}`);
    }
  }, [chatEnabled, route.name]);

  let main: ReactNode = null;
  if (route.name === "people") {
    main = (
      <PeoplePage
        slug={route.slug}
        savedById={saved.savedById}
        onToggleSaved={saved.toggleSaved}
      />
    );
  } else if (route.name === "programs") {
    main = <ProgramsPage savedById={saved.savedById} onToggleSaved={saved.toggleSaved} />;
  } else if (route.name === "calendar") {
    main = (
      <CalendarPage
        dayKey={route.dayKey}
        savedById={saved.savedById}
        savedOnly={savedOnly}
        onToggleSaved={saved.toggleSaved}
      />
    );
  }

  if (route.name === "docs") {
    return <ApiDocsPage />;
  }

  return (
    <div className="shell">
      <TopBar
        route={route}
        chatEnabled={chatEnabled === true}
        onResetChat={() => setChatResetKey((key) => key + 1)}
      />
      <div className={inlineDetail ? "main withInlineDetail" : "main"}>
        <div className="mainContent">
          <div className={route.name === "chat" ? "routePane" : "routePane hidden"}>
            {chatEnabled === true && <ChatPage key={chatResetKey} />}
          </div>
          {route.name !== "chat" && <div className="routePane">{main}</div>}
          {route.name !== "chat" && (
            <AppFooter onAbout={() => setAboutOpen(true)} onPrivacy={() => setPrivacyOpen(true)} />
          )}
        </div>
        {inlineDetail && openItemId && (
          <DetailDrawer
            itemId={openItemId}
            saved={saved.isSaved(openItemId)}
            savedRecord={saved.savedById.get(openItemId)}
            onToggleSaved={saved.toggleSaved}
            onUpdateSaved={saved.updateSavedItem}
            variant="inline"
          />
        )}
      </div>
      {!inlineDetail && openItemId && (
        <DetailDrawer
          itemId={openItemId}
          saved={saved.isSaved(openItemId)}
          savedRecord={saved.savedById.get(openItemId)}
          onToggleSaved={saved.toggleSaved}
          onUpdateSaved={saved.updateSavedItem}
        />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {privacyOpen && <PrivacyNoticeDialog onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}
