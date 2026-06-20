/**
 * Server-only adapter for reading iPhone Measure app screenshots with Claude
 * vision. Each screenshot shows a wall/edge with a white measurement line and a
 * text overlay (e.g. "2.4 m"); we extract those into structured measurements
 * that the reconciliation step pairs with spans the user picks in the 3D view.
 *
 * Uses the Anthropic SDK's structured-output helper so the model is constrained
 * to our schema and we get a validated object back (no brittle JSON parsing).
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { requireEnv } from "./env";

export const MeasurementsSchema = z.object({
  measurements: z.array(
    z.object({
      value: z.number().describe("The numeric magnitude shown, e.g. 2.4"),
      unit: z.enum(["m", "cm", "mm", "ft", "in"]).describe("The unit shown on the label"),
      label: z
        .string()
        .describe("What the line appears to measure, e.g. 'wall width' or 'door height'"),
      confidence: z.number().describe("0..1 confidence this reading is correct"),
    }),
  ),
});

export type ExtractedMeasurements = z.infer<typeof MeasurementsSchema>;

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Extract measurement readings from a Measure-app screenshot (base64, no data-URI prefix). */
export async function extractMeasurements(
  imageBase64: string,
  mediaType: ImageMediaType,
): Promise<ExtractedMeasurements> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system:
      "You read screenshots from Apple's Measure app. Each shows one or more white measurement lines with a numeric label and unit overlaid on a photo of a room. Extract every distinct measurement you can read. Report the value and unit exactly as displayed; do not convert units. If a label is ambiguous, give your best short description and a lower confidence.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Extract all measurements shown in this screenshot.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(MeasurementsSchema) },
  });

  return response.parsed_output ?? { measurements: [] };
}
