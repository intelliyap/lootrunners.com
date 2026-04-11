"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          background: "#008080",
        }}
      >
        <div
          style={{
            background: "#c0c0c0",
            border: "2px outset #fff",
            padding: 0,
            maxWidth: 400,
          }}
        >
          <div
            style={{
              background: "#000080",
              color: "#fff",
              padding: "4px 8px",
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            Lootrunners - Error
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ marginBottom: 12 }}>
              Something went wrong loading Lootrunners.
            </p>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              {error?.message || "Unknown error"}
            </p>
            <div style={{ textAlign: "right" }}>
              <button
                onClick={reset}
                style={{
                  padding: "4px 24px",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
