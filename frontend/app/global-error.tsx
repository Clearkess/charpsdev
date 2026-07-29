"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. This replaces the ENTIRE document (including
 * <html>/<body>) when an error escapes the root layout itself, so it must be
 * fully self-contained with inline styles — it cannot rely on globals.css or
 * any providers having mounted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "28rem",
            borderRadius: "0.875rem",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.1)",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "9999px",
              background: "rgba(220, 38, 38, 0.1)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "1.75rem",
            }}
          >
            !
          </div>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.375rem" }}>
            Application error
          </p>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.5rem" }}>
            A critical error occurred and the app could not load. Please try again.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#94a3b8",
                margin: "0 0 1.5rem",
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.25rem",
              padding: "0 1.25rem",
              borderRadius: "0.625rem",
              border: "none",
              background: "#4f46e5",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
