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

function resolveModel(settings: Settings, forceModel?: Settings["model"]) {
  const { client, preferredModel, mode } = createClientFromSettings(settings);
  const model =
    forceModel === "cheap"
      ? getCheapestModel(mode)
      : forceModel === "best"
      ? getBestModel(mode)
      : preferredModel;
  return { client, model };
}

function prepareMessages(messages: Message[]) {
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");
  const system = systemMessages.map((m) => m.content).join("\n\n") || undefined;
  const anthropicMessages: Anthropic.MessageParam[] = conversationMessages.map(
    (m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })
  );
  return { system, anthropicMessages };
}

export function createStreamingCompletion(params: {
  settings: Settings;
  forceModel?: Settings["model"];
  body: { messages: Message[]; max_tokens?: number; temperature?: number };
}) {
  const { settings, forceModel, body } = params;
  const { client, model } = resolveModel(settings, forceModel);
  const { system, anthropicMessages } = prepareMessages(body.messages);

  return client.messages.stream({
    model,
    max_tokens: body.max_tokens || 4096,
    system,
    messages: anthropicMessages,
    temperature: body.temperature,
  });
}

export async function createCompletion(params: {
  settings: Settings;
  label: string;
  forceModel?: Settings["model"];
  body: CompletionParams;
  user: User | null;
}): Promise<CompletionResult> {
  const { settings, forceModel, body } = params;
  const { client, model } = resolveModel(settings, forceModel);
  const { system, anthropicMessages } = prepareMessages(body.messages);

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
