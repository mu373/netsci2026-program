import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Scalar?: {
      createApiReference: (
        target: string | HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

const SCALAR_SCRIPT_ID = "scalar-api-reference-script";
const SCALAR_SCRIPT_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";

function loadScalarScript() {
  if (window.Scalar) return Promise.resolve();

  const existing = document.getElementById(SCALAR_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Scalar.")), {
        once: true,
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCALAR_SCRIPT_ID;
    script.src = SCALAR_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Scalar."));
    document.head.appendChild(script);
  });
}

export function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadScalarScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.Scalar) return;
        containerRef.current.innerHTML = "";
        window.Scalar.createApiReference(containerRef.current, {
          _integration: "react-fallback",
          url: "/openapi.json",
        });
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Scalar.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="apiDocsPane">
      {error && (
        <div className="notice">
          {error} The OpenAPI spec is available at{" "}
          <a href="/openapi.json" target="_blank" rel="noreferrer">
            /openapi.json
          </a>
          .
        </div>
      )}
      {!error && !loaded && <div className="notice">Loading API docs...</div>}
      <div className="scalarDocsMount" ref={containerRef} />
    </section>
  );
}
