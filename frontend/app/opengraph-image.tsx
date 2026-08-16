import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * File-based Open Graph image (served at /opengraph-image). Rendered at
 * request time via next/og's ImageResponse so it stays in sync with
 * APP_NAME without needing a static asset, and matches Vaultra's
 * navy/teal "clean fintech" branding (see BrandMark.tsx / public/logo*.png
 * for the matching icon + wordmark used elsewhere in the app).
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
          backgroundColor: "#0b1120",
          backgroundImage:
            "radial-gradient(circle at 78% 18%, rgba(20,184,166,0.30), transparent 45%), radial-gradient(circle at 15% 85%, rgba(15,27,61,0.55), transparent 50%)",
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
            <defs>
              <linearGradient id="vg" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0" stopColor="#0f1b3d" />
                <stop offset="1" stopColor="#14e0c4" />
              </linearGradient>
            </defs>
            <path
              d="M32 3 C 44 3 58 12 58 24 C 58 38 44 55 32 61 C 20 55 6 38 6 24 C 6 12 20 3 32 3 Z"
              fill="url(#vg)"
            />
            <path
              d="M20 22 L32 46 L44 22"
              stroke="#0b1120"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="19" r="6" fill="none" stroke="#0b1120" strokeWidth="3.2" />
          </svg>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: "#f7f9fc" }}>Vaultra</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            color: "#f7f9fc",
            textAlign: "center",
            maxWidth: 940,
            lineHeight: 1.25,
          }}
        >
          Discover Unique Accounts in our Marketplace
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 22,
            color: "#8b94a7",
            letterSpacing: 1.5,
            textAlign: "center",
            maxWidth: 820,
          }}
        >
          SOCIAL MEDIA ACCOUNTS · VIRTUAL NUMBERS · ESIMS · DIGITAL PRODUCTS
        </div>
      </div>
    ),
    { ...size }
  );
}
