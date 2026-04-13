type RawMessage = { role: string; content: any };
type SanitizedMessage = { role: "user" | "assistant" | "system"; content: any };

export function sanitizeUserMessages(
  messages: RawMessage[],
  maxCount = 20
): SanitizedMessage[] {
  return messages
    .filter(
      (m): m is SanitizedMessage =>
        m.role === "user" || m.role === "assistant"
    )
    .slice(-maxCount);
}

export function sanitizeWithSystem(
  messages: RawMessage[],
  maxCount = 20
): SanitizedMessage[] {
  const systemMsg = messages.find(
    (m): m is SanitizedMessage => m.role === "system"
  );
  const conversationMsgs = messages
    .filter(
      (m): m is SanitizedMessage =>
        m.role === "user" || m.role === "assistant"
    )
    .slice(-maxCount);
  return systemMsg ? [systemMsg, ...conversationMsgs] : conversationMsgs;
}
