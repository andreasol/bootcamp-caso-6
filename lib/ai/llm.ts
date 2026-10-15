// The only place that talks to the LLM provider (any OpenAI-compatible API: NVIDIA NIM, OpenRouter…). server-only keeps the key out of any
// client bundle; it is read from LLM_API_KEY (never NEXT_PUBLIC_).
import "server-only";
import OpenAI from "openai";
import { RESPONSE_JSON_SCHEMA } from "./schema";
import type { CompleteFn } from "./prioritize";

export interface LlmConfig {
  model: string;
  timeoutMs: number;
}

export function llmConfig(): LlmConfig {
  return {
    model: process.env.LLM_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 50_000,
  };
}

export function llmComplete(): CompleteFn {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return async () => {
      throw new Error("LLM_API_KEY no está configurada en este entorno");
    };
  }
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    maxRetries: 0,
  });
  const { model } = llmConfig();

  return async (messages, signal) => {
    const res = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "discrepancy_insights", strict: true, schema: RESPONSE_JSON_SCHEMA as unknown as Record<string, unknown> },
        },
      },
      { signal },
    );
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("Respuesta vacía del modelo");
    return content;
  };
}
