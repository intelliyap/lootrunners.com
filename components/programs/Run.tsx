"use client";
import { useAtomValue, useSetAtom } from "jotai";
import { windowsListAtom } from "@/state/windowsList";
import { createWindow } from "../../lib/createWindow";
import { ProgramEntry, programsAtom } from "@/state/programs";
import { useEffect, useState } from "react";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import { useFlags } from "@/flags/context";
import { trpc } from "@/lib/api/client";
import { SettingsLink } from "../SettingsLink";
import wrappedFetch from "@/lib/wrappedFetch";

function hasSession() {
  return document.cookie.includes("lr_session=");
}

function AccessCodePrompt({ onSuccess }: { onSuccess: () => void }) {
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
        onSuccess();
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
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <p>Enter access code to generate programs:</p>
      <div className="field-row">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          disabled={loading}
          style={{ flex: 1 }}
          placeholder="Access code"
        />
        <button type="submit" disabled={loading || !code}>
          {loading ? "..." : "OK"}
        </button>
      </div>
      {error && (
        <p style={{ color: "red", margin: 0, fontSize: 12 }}>{error}</p>
      )}
    </form>
  );
}

export function Run({ id }: { id: string }) {
  const windowsDispatch = useSetAtom(windowsListAtom);
  const programsDispatch = useSetAtom(programsAtom);
  const settings = useAtomValue(settingsAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const flags = useFlags();
  const { data } = trpc.getTokens.useQuery();

  useEffect(() => {
    setAuthenticated(hasSession());
  }, []);

  if (!authenticated) {
    return (
      <div style={{ padding: 4 }}>
        <AccessCodePrompt onSuccess={() => setAuthenticated(true)} />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <button
            onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const programDescription = formData.get("program-description");
        if (typeof programDescription === "string") {
          let name = programDescription;

          if (name.length > 20) {
            const nameResp = await wrappedFetch("/api/name", {
              method: "POST",
              body: JSON.stringify({
                desc: programDescription,
                settings: getSettings(),
              }),
            });

            name = (await nameResp.json()).name;
          }

          const program: ProgramEntry = {
            id: name,
            prompt: programDescription,
            name,
          };

          programsDispatch({ type: "ADD_PROGRAM", payload: program });

          createWindow({
            title: name,
            program: {
              type: "iframe",
              programID: program.id,
            },
            loading: true,
            size: {
              width: 700,
              height: 550,
            },
          });
          windowsDispatch({ type: "REMOVE", payload: id });
        }
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p>
          Type the description of the program you want to run and Lootrunners
          will create it for you.
        </p>
        {flags.tokens && (
          <>
            <p>
              You are currently using the{" "}
              <strong>{settings.model === "best" ? "Quality" : "Fast"}</strong>{" "}
              model. You currently have{" "}
              <strong style={{ color: "green" }}>{data?.tokens}</strong> Quality
              Tokens left. You can enter your own API key in the{" "}
              <SettingsLink />.
            </p>
          </>
        )}
      </div>
      <div className="field-row">
        <textarea
          placeholder="Describe the program you want to run"
          id="program-description"
          rows={2}
          style={{
            width: "100%",
            resize: "vertical",
            maxHeight: "200px",
          }}
          name="program-description"
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit" disabled={isLoading}>
          Open
        </button>
        <button
          onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
