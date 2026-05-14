import Anthropic from "@anthropic-ai/sdk";

// Anthropic Claude client wrapper.
//
// Mirrors the old lib/openai/client.ts pattern: returns null when the API
// key is missing so every AI route can gracefully fall back to its
// deterministic rules-based result without throwing.
//
// Model presets are split by use case:
//   FAST  → Claude Haiku 4.5. Cheapest and fastest. Use on high-volume
//           routes that run on every page render (valuation, match, ROI).
//           $1/M input, $5/M output.
//   SMART → Claude Sonnet 4.6. Best speed/intelligence balance. Use on
//           quality-critical routes where the reasoning shows in the
//           output (contracts, negotiation). $3/M input, $15/M output.
//
// Both models support adaptive thinking, structured outputs, and prompt
// caching. If you ever need stronger reasoning than Sonnet, escalate the
// specific route to claude-opus-4-7 — but that's overkill for beta.

export const CLAUDE_MODELS = {
  FAST: "claude-haiku-4-5",
  SMART: "claude-sonnet-4-6"
} as const;

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];

export function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Helper: extract text from a Claude response. Anthropic returns content
 * as an array of typed blocks (text, thinking, tool_use, etc.) rather
 * than a single string like OpenAI does. For our routes that just want
 * the textual output, this picks the first text block and returns its
 * content — or null if nothing usable came back.
 */
export function extractText(response: Anthropic.Message): string | null {
  for (const block of response.content) {
    if (block.type === "text") return block.text;
  }
  return null;
}
