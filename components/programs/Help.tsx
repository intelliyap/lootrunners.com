"use client";

import {
  ProgramEntry,
  programAtomFamily,
  programsAtom,
} from "@/state/programs";
import { registryAtom } from "@/state/registry";
import { windowAtomFamily } from "@/state/window";
import { windowsListAtom } from "@/state/windowsList";
import { getApiText } from "@/lib/apiText";
import { assert } from "@/lib/assert";
import { getRegistryKeys } from "@/lib/getRegistryKeys";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState, useRef } from "react";
import Markdown from "react-markdown";
import { getSettings } from "@/lib/getSettings";
import styles from "./Help.module.css";
import imageIcon from "@/components/assets/image.png";
import wrappedFetch from "@/lib/wrappedFetch";
import { AccessCodePrompt } from "../AccessCodePrompt";

type Message = {
  role: string;
  content:
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
};

type Messages = Message[];

const makePrompt = (program: ProgramEntry, keys: string[]) => {
  return `You are the developer of this Lootrunners OS application. Here is its current source:

\`\`\`html
${program.code}
\`\`\`

OS APIs available on window:
${getApiText(keys)}

Rules:
- If the user reports a bug or requests a change, fix it and return the COMPLETE updated HTML wrapped in \`\`\`html markers. The app will update live.
- Only use \`\`\`html markers when returning a full standalone HTML document.
- If just answering a question, respond normally without code markers.
- Keep responses concise. Don't explain what you changed unless asked.
- Always return complete, valid, working HTML when making changes.
`;
};

const betweenHtmlRegex = /```html[\s\S]*?<html>([\s\S]*?)<\/html>[\s\S]*?```/;

export function Help({ id }: { id: string }) {
  const helpWindow = useAtomValue(windowAtomFamily(id));
  const windowsListDispatch = useSetAtom(windowsListAtom);
  const registry = useAtomValue(registryAtom);
  assert(
    helpWindow.program.type === "help" && helpWindow.program.targetWindowID,
    "Help window must have a target window ID"
  );
  const targetWindow = useAtomValue(
    windowAtomFamily(helpWindow.program.targetWindowID)
  );
  const programsDispatch = useSetAtom(programsAtom);
  assert(
    targetWindow.program.type === "iframe",
    "Target window is not an iframe"
  );

  const programID = targetWindow.program.programID;

  useEffect(() => {
    if (!targetWindow) {
      windowsListDispatch({
        type: "REMOVE",
        payload: id,
      });
    }
  }, [id, targetWindow, windowsListDispatch]);

  const program = useAtomValue(programAtomFamily(programID));

  const keys = getRegistryKeys(registry);

  const [messages, setMessages] = useState<Messages>(() => [
    { role: "system", content: makePrompt(program!, keys) },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(() => {
    if (typeof document === "undefined") return false;
    return !document.cookie.includes("lr_session=");
  });
  const [pendingFix, setPendingFix] = useState<string | null>(null);

  const sendMessage = async () => {
    const newMessage = {
      role: "user",
      content: [
        { type: "text", text: input } as const,
        attachment
          ? ({ type: "image_url", image_url: { url: attachment } } as const)
          : null,
      ].filter(Boolean),
    } as Message;
    setMessages([...messages, newMessage]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    try {
      const response = await wrappedFetch("/api/help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, newMessage],
          settings: getSettings(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsAuth(true);
        } else {
          setMessages([
            ...messages,
            newMessage,
            { role: "assistant", content: "Something went wrong. Please try again." },
          ]);
        }
        return;
      }

      const data = await response.json();

      if (typeof data === "string") {
        const newHtml = data.match(betweenHtmlRegex);

        if (newHtml) {
          // Don't auto-apply — store pending fix for user to review
          const fixedCode = `<!DOCTYPE html><html>${newHtml[1]}</html>`;
          setPendingFix(fixedCode);
        }

        setMessages([
          ...messages,
          newMessage,
          { role: "assistant", content: data },
        ]);
      } else {
        setMessages([
          ...messages,
          newMessage,
          { role: "assistant", content: "Unexpected response. Please try again." },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([
        ...messages,
        newMessage,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64data = event.target?.result as string;
            setAttachment(base64data);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64data = event.target?.result as string;
        setAttachment(base64data);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatBox} role="log" aria-label="Chat messages">
        <ChatMessage
          msg={{
            role: "system",
            content:
              "Hey! I built this app. Tell me about any bugs or changes you want — describe the issue and I'll generate a fix you can apply. \n\n**What needs fixing?**",
          }}
          pendingFix={null}
          onApplyFix={() => {}}
          onSkipFix={() => {}}
          onRequestFix={() => {}}
          isLastAssistant={false}
        />
        {(() => {
          const visibleMessages = messages.filter((msg) => msg.role !== "system");
          const lastAssistantIndex = visibleMessages.length - 1 -
            [...visibleMessages].reverse().findIndex((m) => m.role === "assistant");
          return visibleMessages.map((msg, index) => (
            <ChatMessage
              key={index}
              msg={msg}
              pendingFix={pendingFix}
              onApplyFix={() => {
                if (pendingFix) {
                  programsDispatch({
                    type: "UPDATE_PROGRAM",
                    payload: { id: programID, code: pendingFix },
                  });
                  setPendingFix(null);
                }
              }}
              onSkipFix={() => setPendingFix(null)}
              onRequestFix={() => {
                setInput("Please fix this — return the complete updated HTML.");
                setTimeout(() => sendMessage(), 100);
              }}
              isLastAssistant={msg.role === "assistant" && index === lastAssistantIndex}
            />
          ));
        })()}
        {isLoading && (
          <div className={styles.loadingIndicator}>
            <span>L</span>
            <span>O</span>
            <span>A</span>
            <span>D</span>
            <span>I</span>
            <span>N</span>
            <span>G</span>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        )}
      </div>
      {needsAuth ? (
        <div style={{ padding: "0 10px 10px" }}>
          <AccessCodePrompt
            message="Session expired. Enter access code to continue:"
            onSuccess={() => {
              setNeedsAuth(false);
              setIsLoading(false);
            }}
          />
        </div>
      ) : (
      <div className={styles.chatInput}>
        <div
          role="button"
          tabIndex={0}
          title="Attach image"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginRight: 5 }}
        >
          <img
            src={attachment ? attachment : imageIcon.src}
            alt="Attached Image"
            width={24}
            height={24}
            className={styles.thumbnail}
            onClick={() => setAttachment(null)}
          />
        </div>
        <input
          type="text"
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
          onPaste={handlePaste}
          disabled={isLoading}
          style={{ height: "100%" }}
        />

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button aria-label="Send message" onClick={sendMessage} disabled={isLoading}>
          Send
        </button>
      </div>
      )}
    </div>
  );
}

function ChatMessage({
  msg,
  pendingFix,
  onApplyFix,
  onSkipFix,
  onRequestFix,
  isLastAssistant,
}: {
  msg: Message;
  pendingFix: string | null;
  onApplyFix: () => void;
  onSkipFix: () => void;
  onRequestFix: () => void;
  isLastAssistant: boolean;
}) {
  const str =
    typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((item) => item.text)
          .join("");

  const attachments =
    typeof msg.content === "string"
      ? []
      : msg.content.filter(
          (c): c is { type: "image_url"; image_url: { url: string } } =>
            c.type === "image_url"
        );

  const hasCode = betweenHtmlRegex.test(str);
  const displayText = hasCode
    ? str.replace(betweenHtmlRegex, "")
    : str;

  return (
    <div>
      <div
        className={`${styles.chatMessage} ${
          msg.role === "user" ? styles.user : styles.assistant
        }`}
      >
        {attachments.map((attachment, index) => (
          <img
            key={index}
            src={attachment.image_url.url}
            alt="Attachment"
            style={{ maxWidth: 200, maxHeight: 200, objectFit: "contain" }}
          />
        ))}
        {displayText.trim() && (
          <Markdown className={styles.markdown}>{displayText}</Markdown>
        )}
        {/* Show Apply/Skip buttons when AI returned code */}
        {msg.role === "assistant" && hasCode && pendingFix && isLastAssistant && (
          <div className={styles.fixActions}>
            <div className={styles.fixBanner}>Fix ready to apply</div>
            <div className={styles.fixButtons}>
              <button onClick={onApplyFix} className={styles.applyButton}>
                Apply Fix
              </button>
              <button onClick={onSkipFix}>
                Skip
              </button>
            </div>
          </div>
        )}
        {/* Show "Fix it" button when AI explained but didn't return code */}
        {msg.role === "assistant" && !hasCode && isLastAssistant && (
          <div className={styles.fixActions}>
            <button onClick={onRequestFix} className={styles.fixItButton}>
              Fix it for me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

