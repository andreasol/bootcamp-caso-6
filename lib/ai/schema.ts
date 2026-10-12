// The only shape the model may answer with. Sent as a strict JSON schema and re-validated
// with zod, because a schema request is a hint to the provider, not a guarantee.
import { z } from "zod";

export const PROMPT_VERSION = "prioritize-v1";

export const insightSchema = z
  .object({
    id: z.string(),
    priority: z.number().int().min(1).max(3),
    explanation: z.string().trim().min(1).max(600),
    suggested_action: z.string().trim().min(1).max(300),
    confidence: z.number().min(0).max(1),
    related_ids: z.array(z.string()).max(20),
  })
  .strict();

export const responseSchema = z.object({ items: z.array(insightSchema).min(1).max(200) }).strict();

export type ModelInsight = z.infer<typeof insightSchema>;

// Hand-written JSON schema (strict mode needs every property required and no extras).
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "priority", "explanation", "suggested_action", "confidence", "related_ids"],
        properties: {
          id: { type: "string" },
          priority: { type: "integer", minimum: 1, maximum: 3 },
          explanation: { type: "string" },
          suggested_action: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          related_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
