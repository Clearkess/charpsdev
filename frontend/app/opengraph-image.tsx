import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * File-based Open Graph image (served at /opengraph-image). Rendered at
 * request time via next/og's ImageResponse so it stays in sync with
 * APP_NAME without needing a static asset, and matches the landing page's
 * dark/gold branding (see app/globals.css .landing --gold/--ink tokens).
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#060708",
          backgroundImage:
            "radial-gradient(circle at 78% 22%, rgba(246,185,31,0.28), transparent 45%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 2 L59 17 V47 L32 62 L5 47 V17 Z"
              stroke="#f6b91f"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M27 24 L20 32 L27 40"
              stroke="#f6b91f"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="38" cy="32" r="4" fill="#f6b91f" />
          </svg>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: "#f6b91f" }}>Charps</span>
            <span style={{ color: "#f7f5ef" }}>Dev</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 700,
            color: "#f7f5ef",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          Digital Services. Made Simple.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 24,
            color: "#a7a7aa",
            letterSpacing: 2,
          }}
        >
          DATA · AIRTIME · GIFT CARDS · VIRTUAL NUMBERS · ESIMS
        </div>
      </div>
    ),
    { ...size }
  );
}
