"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[The NUESA Library] Global error boundary caught:", error);
  }, [error]);

  const handleRecover = () => {
    if (typeof retry === "function") {
      retry();
    } else if (typeof reset === "function") {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <head>
        <title>Error — The NUESA Library</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAFA",
          color: "#0F172A",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "24px",
              fontWeight: 800,
              color: "#0C3B2E",
            }}
          >
            The NUESA Library encountered an error
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "14px",
              color: "#64748B",
              lineHeight: 1.6,
            }}
          >
            Please try reloading the page. If the issue persists, check your network connection or try again shortly.
          </p>
          <button
            type="button"
            onClick={handleRecover}
            style={{
              backgroundColor: "#00875A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "12px",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
