type GtagArg = string | Date | Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: GtagArg[][];
    gtag?: (...args: GtagArg[]) => void;
  }
}

const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID?.trim();
let activeMeasurementId: string | null = null;
let lastPagePath: string | null = null;

export function initAnalytics() {
  if (!measurementId || typeof window === "undefined") return;
  if (activeMeasurementId === measurementId) return;
  activeMeasurementId = measurementId;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: GtagArg[]) {
      window.dataLayer?.push(args);
    };

  const existingScript = [...document.scripts].some((script) => script.dataset.gaMeasurementId === measurementId);
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.gaMeasurementId = measurementId;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

export function trackPageView() {
  if (!activeMeasurementId || typeof window === "undefined" || !window.gtag) return;

  const pagePath = `${window.location.pathname}${window.location.search}`;
  if (pagePath === lastPagePath) return;
  lastPagePath = pagePath;

  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title,
  });
}
