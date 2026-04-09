import type { Settings } from "@/state/settings";
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic";

export const getBestModel = (_mode: Provider) => {
  return "claude-sonnet-4-5-20250514";
};

export const getCheapestModel = (_mode: Provider) => {
  return "claude-haiku-4-5-20251001";
};

function getAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });
}

export function createClientFromSettings(settings: Settings): {
  mode: Provider;
  client: Anthropic;
  usedOwnKey: boolean;
  preferredModel: string;
} {
  const usedOwnKey = !!settings.apiKey;
  const mode: Provider = "anthropic";
  const client = getAnthropicClient(settings.apiKey || undefined);
  const preferredModel =
    settings.model === "cheap" ? getCheapestModel(mode) : getBestModel(mode);

  return { mode, client, usedOwnKey, preferredModel };
}
