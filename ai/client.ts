import type { Settings } from "@/state/settings";
import OpenAI from "openai";

type Provider = "anthropic" | "openai";
const DEFAULT_MODE: Provider = process.env.ANTHROPIC_API_KEY
  ? "anthropic"
  : "openai";

export const getBestModel = (mode: Provider) => {
  switch (mode) {
    case "anthropic":
      return "claude-sonnet-4-5-20250514";
    case "openai":
      return "gpt-4o";
  }
};

export const getCheapestModel = (mode: Provider) => {
  switch (mode) {
    case "anthropic":
      return "claude-haiku-4-5-20251001";
    case "openai":
      return "gpt-4o-mini";
  }
};

const createClient = (mode: Provider) => {
  switch (mode) {
    case "anthropic":
      return new OpenAI({
        baseURL: "https://api.anthropic.com/v1",
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    case "openai":
      return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
  }
};

export function getClientFromKey(apiKey: string): {
  mode: Provider;
  client: OpenAI;
} {
  return {
    mode: "anthropic",
    client: new OpenAI({
      apiKey,
      baseURL: "https://api.anthropic.com/v1",
    }),
  };
}

export const getDefaultClient = () => createClient(DEFAULT_MODE);

export function createClientFromSettings(settings: Settings): {
  mode: Provider;
  client: OpenAI;
  usedOwnKey: boolean;
  preferredModel: string;
} {
  if (!settings.apiKey) {
    return {
      mode: DEFAULT_MODE,
      client: getDefaultClient(),
      usedOwnKey: false,
      preferredModel:
        settings.model === "cheap"
          ? getCheapestModel(DEFAULT_MODE)
          : getBestModel(DEFAULT_MODE),
    };
  }
  const client = getClientFromKey(settings.apiKey);
  return {
    ...client,
    client: getClientFromKey(settings.apiKey).client,
    usedOwnKey: true,
    preferredModel:
      settings.model === "cheap"
        ? getCheapestModel(client.mode)
        : getBestModel(client.mode),
  };
}
