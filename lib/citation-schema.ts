/**
 * Citation schema for AI responses using ai-sdk/react streamObject
 */

import { z } from "zod";

export const citationSchema = z.object({
  content: z.string().describe("The main response content with inline citations marked as [1], [2], etc."),
  citations: z
    .array(
      z.object({
        number: z.number().describe("The citation number referenced in content [N]"),
        title: z.string().describe("Source title or headline"),
        url: z.string().describe("Source URL"),
        description: z.string().optional().describe("Brief description or quote from the source"),
      })
    )
    .optional()
    .default([])
    .describe("Array of citation sources"),
});

export type CitationSchema = z.infer<typeof citationSchema>;
