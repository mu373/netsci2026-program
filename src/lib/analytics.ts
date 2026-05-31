type GtagArg = string | Date | Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: GtagArg[][];
    gtag?: (...args: GtagArg[]) => void;
  }
}

const measurementId = "G-8BRBLEJSEY";
let lastPagePath =
  typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`;

export const analyticsEnabled = true;

export function trackPageView() {
  if (typeof window === "undefined" || !window.gtag) return;

  const pagePath = `${window.location.pathname}${window.location.search}`;
  if (pagePath === lastPagePath) return;
  lastPagePath = pagePath;

  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title,
  });
}
