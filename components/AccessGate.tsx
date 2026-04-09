"use client";

import { useState } from "react";

export function AccessGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        setError(data.error || "Invalid access code");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="window" style={{ width: 320 }}>
        <div className="title-bar">
          <div className="title-bar-text">Welcome to LootRunners</div>
        </div>
        <div className="window-body">
          <form onSubmit={handleSubmit}>
            <div className="field-row-stacked" style={{ width: "100%" }}>
              <label htmlFor="access-code">Enter access code:</label>
              <input
                id="access-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
            {error && (
              <p style={{ color: "red", margin: "8px 0 0 0", fontSize: 12 }}>
                {error}
              </p>
            )}
            <div
              className="field-row"
              style={{ justifyContent: "flex-end", marginTop: 8 }}
            >
              <button type="submit" disabled={loading || !code}>
                {loading ? "Verifying..." : "OK"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
