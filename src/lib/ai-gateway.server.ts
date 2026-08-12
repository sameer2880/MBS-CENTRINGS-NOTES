import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      runId ||= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  });

  return provider;
}

export function createOpenAiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    supportsStructuredOutputs: true,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/**
 * Picks the vision model provider available in the current runtime.
 * - Lovable hosting supplies LOVABLE_API_KEY automatically.
 * - Self-hosted deploys (e.g. Vercel) supply OPENAI_API_KEY in env vars.
 */
export function resolveVisionModel() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return createLovableAiGatewayProvider(lovableKey)("google/gemini-3.6-flash");
  }

  const openAiKey = process.env["OPENAI_API_KEY"];
  if (openAiKey) {
    const model = process.env["OPENAI_VISION_MODEL"] || "gpt-4o";
    return createOpenAiProvider(openAiKey)(model);
  }

  return null;
}
