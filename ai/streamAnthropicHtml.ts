import Anthropic from "@anthropic-ai/sdk";

type MessageStream = ReturnType<Anthropic["messages"]["stream"]>;

export function streamAnthropicHtml(
  stream: MessageStream,
  options?: { injectIntoHead?: string }
): ReadableStream {
  const injectIntoHead = options?.injectIntoHead;

  return new ReadableStream({
    async start(controller) {
      try {
        let programResult = "";
        let startedSending = false;
        let sentIndex = 0;

        for await (const event of stream) {
          // Abort if client disconnected
          if (controller.desiredSize === null) {
            stream.abort();
            break;
          }

          if (
            event.type !== "content_block_delta" ||
            event.delta.type !== "text_delta"
          ) {
            continue;
          }

          const value = event.delta.text;
          programResult += value;

          if (startedSending) {
            const match = programResult.match(/<\/html>/);
            if (match) {
              controller.enqueue(
                programResult.slice(sentIndex, match.index! + match[0].length)
              );
              break;
            } else {
              controller.enqueue(value);
              sentIndex = programResult.length;
            }
          } else {
            const match = programResult.match(/<head>|<body>/);
            if (match) {
              const afterMatch = programResult.slice(
                match.index! + match[0].length
              );
              let newContent =
                match[0] === "<body>"
                  ? `<head>${injectIntoHead ?? ""}</head><body>` + afterMatch
                  : `<head>${injectIntoHead ?? ""}` + afterMatch;

              const endOfHtml = newContent.match(/<\/html>/);
              newContent = endOfHtml
                ? newContent.slice(0, endOfHtml.index! + endOfHtml[0].length)
                : newContent;

              programResult = `<!DOCTYPE html><html>` + newContent;
              controller.enqueue(programResult);
              sentIndex = programResult.length;
              startedSending = true;
            }
          }
        }

        if (!startedSending) {
          controller.enqueue("<!DOCTYPE html><html>");
        }
        if (!programResult.includes("</html>")) {
          controller.enqueue("</html>");
        }
        controller.close();
      } catch (e) {
        console.error("Stream error:", e);
        try {
          stream.abort();
        } catch { /* already closed */ }
        try {
          controller.error(e);
        } catch { /* already closed */ }
      }
    },
    cancel() {
      // Client disconnected — abort the Anthropic stream to stop billing
      try {
        stream.abort();
      } catch { /* already closed */ }
    },
  }).pipeThrough(new TextEncoderStream());
}
