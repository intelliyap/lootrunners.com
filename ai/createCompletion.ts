import { Settings } from "@/state/settings";
import {
  createClientFromSettings,
  getBestModel,
  getCheapestModel,
} from "./client";
import { User } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

type Message = { role: "user" | "assistant" | "system"; content: string };

interface CompletionParams {
  messages: Message[];
  max_tokens?: number;
  stream?: boolean;
  temperature?: number;
  model?: string;
}

// Non-streaming: returns an OpenAI-compatible shape
interface CompletionResult {
  choices: [{ message: { content: string | null } }];
}

export async function createCompletion(params: {
  settings: Settings;
  label: string;
  forceModel?: Settings["model"];
  body: CompletionParams;
  user: User | null;
}): Promise<any> {
  const { settings, forceModel, body } = params;
  const { client, preferredModel, mode } = createClientFromSettings(settings);
  const model =
    forceModel === "cheap"
      ? getCheapestModel(mode)
      : forceModel === "best"
      ? getBestModel(mode)
      : preferredModel;

  // Separate system messages from user/assistant messages
  const systemMessages = body.messages.filter((m) => m.role === "system");
  const conversationMessages = body.messages.filter(
    (m) => m.role !== "system"
  );
  const system = systemMessages.map((m) => m.content).join("\n\n") || undefined;

  const anthropicMessages: Anthropic.MessageParam[] = conversationMessages.map(
    (m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })
  );

  if (body.stream) {
    // Return an async iterator that yields OpenAI-compatible chunks
    const stream = await client.messages.stream({
      model,
      max_tokens: body.max_tokens || 4096,
      system,
      messages: anthropicMessages,
      temperature: body.temperature,
    });

    // Create an async iterable that mimics OpenAI's stream format
    const openaiCompatStream = {
      [Symbol.asyncIterator]: async function* () {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield {
              choices: [
                {
                  delta: { content: event.delta.text },
                  finish_reason: null,
                },
              ],
            };
          }
        }
        yield {
          choices: [{ delta: {}, finish_reason: "stop" }],
        };
      },
    };

    return openaiCompatStream;
  } else {
    // Non-streaming
    const response = await client.messages.create({
      model,
      max_tokens: body.max_tokens || 4096,
      system,
      messages: anthropicMessages,
      temperature: body.temperature,
    });

    const content =
      response.content[0]?.type === "text" ? response.content[0].text : null;

    const result: CompletionResult = {
      choices: [{ message: { content } }],
    };

    return result;
  }
}
