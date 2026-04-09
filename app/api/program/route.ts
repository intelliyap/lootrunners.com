import { streamAnthropicHtml } from "@/ai/streamAnthropicHtml";
import { getApiText } from "@/lib/apiText";
import { createPaymentRequiredResponse } from "@/server/paymentRequiredResponse";

import { getSettingsFromGetRequest } from "@/lib/getSettingsFromRequest";
import { createClientFromSettings } from "@/ai/client";
import { Settings } from "@/state/settings";
import { getUser } from "@/lib/auth/getUser";
import { log } from "@/lib/log";
import { capture } from "@/lib/capture";
import { canGenerate } from "@/server/usage/canGenerate";
import { createClient } from "@/lib/supabase/server";
import { insertGeneration } from "@/server/usage/insertGeneration";
import { isLocal } from "@/lib/isLocal";
import { createStreamingCompletion } from "@/ai/createCompletion";
import { getMaxTokens } from "@/ai/getMaxTokens";
import { checkAccess } from "@/lib/apiGuard";

export async function GET(req: Request) {
  const denied = await checkAccess(req, "program");
  if (denied) return denied;

  const settings = await getSettingsFromGetRequest(req);
  const user = await getUser();
  if (!isLocal() && settings.model !== "cheap") {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    if (!settings.apiKey) {
      const client = await createClient();
      const hasTokens = await canGenerate(client, user);

      if (!hasTokens) {
        return createPaymentRequiredResponse();
      }

      await insertGeneration({
        client,
        user,
        tokensUsed: 1,
        action: "program",
      });
    }
  }

  const url = new URL(req.url);

  const desc = url.searchParams.get("description");
  const keys = JSON.parse(url.searchParams.get("keys") ?? "[]");
  if (!desc) {
    return new Response("No description", {
      status: 404,
    });
  }

  const programStream = await createProgramStream({
    desc,
    keys,
    settings,
    req,
  });
  return new Response(
    streamAnthropicHtml(programStream, {
      injectIntoHead: `<script src="/api.js"></script>
<link
  rel="stylesheet" 
href="https://unpkg.com/98.css"
>
<link
  rel="stylesheet"
  href="/reset.css"
>`,
    }),
    {
      headers: {
        "Content-Type": "text/html",
      },
      status: 200,
    }
  );
}

function makeSystem(keys: string[]) {
  log(keys);
  return `You are Lootrunners OS, an AI-powered retro operating system that generates fully functional applications on demand. You will receive a description of an application, and your job is to imagine what it does and build it.

Implement the application in HTML, CSS, and JavaScript. Use the 98.css library for a retro Windows 98 aesthetic — it's already included. The code runs inside an iframe within a window, so don't include window or window-body wrapper elements.

Rules:
- Output ONLY the raw HTML wrapped in <html> tags. No commentary, explanations, or markdown.
- Make programs fill the entire available space.
- Don't use external images — draw assets with CSS/SVG/canvas.
- Don't use the 98.css \`window\` or \`window-body\` classes.
- Don't add a menu bar — the OS handles that.
- Make the app genuinely functional and interactive, not just a mockup.
- Use modern JavaScript (ES2020+). Add event listeners, state management, and real logic.
- Be creative — build something that actually works and is fun to use.

The OS provides these APIs on the window object:

${getApiText(keys)}
`;
}

async function createProgramStream({
  desc,
  keys,
  settings,
  req,
}: {
  desc: string;
  keys: string[];
  settings: Settings;
  req: Request;
}) {
  const { usedOwnKey, preferredModel } = createClientFromSettings(settings);

  await capture(
    {
      type: "program",
      usedOwnKey,
      model: preferredModel,
    },
    req
  );

  const stream = createStreamingCompletion({
    settings,
    body: {
      messages: [
        {
          role: "system",
          content: makeSystem(keys),
        },
        {
          role: "user",
          content: `<app_name>${desc}</app_name>`,
        },
      ],
      temperature: 1,
      max_tokens: getMaxTokens(settings),
    },
  });

  return stream;
}
