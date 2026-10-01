// Nous Portal's documented OpenAI-compatible external-app endpoint.
export const NOUS_INFERENCE_BASE_URL = "https://inference-api.nousresearch.com/v1";
export const NOUS_CHAT_COMPLETIONS_URL = `${NOUS_INFERENCE_BASE_URL}/chat/completions`;
export const NOUS_MODELS_URL = `${NOUS_INFERENCE_BASE_URL}/models`;

// These stable Portal model IDs are intentionally limited to Nous' own advertised
// Hermes 4 models. The connected-model discovery endpoint is the source of truth
// for the changing Portal catalog and a user's actual entitlements.
export const NOUS_VALIDATION_MODEL = "nousresearch/hermes-4-70b";

const asPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getRawModels = (payload) => {
  const models = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.models || payload?.results || [];
  return Array.isArray(models) ? models : [];
};

const isChatCapable = (model) => {
  const outputModalities = model?.architecture?.output_modalities;
  if (!Array.isArray(outputModalities) || outputModalities.length === 0) return true;
  return outputModalities.includes("text");
};

// Convert upstream catalog entries to router IDs without corrupting vendor/model
// identifiers that themselves contain a slash.
export function normalizeNousModels(payload) {
  return getRawModels(payload)
    .filter(isChatCapable)
    .map((model) => {
      const upstreamModelId = typeof model?.id === "string" ? model.id.trim() : "";
      if (!upstreamModelId) return null;

      const contextLength = asPositiveInteger(
        model.context_length ?? model.top_provider?.context_length,
      );
      const maxOutputTokens = asPositiveInteger(
        model.top_provider?.max_completion_tokens ?? model.max_completion_tokens,
      );

      return {
        id: `nous/${upstreamModelId}`,
        upstreamModelId,
        name: model.name || upstreamModelId,
        ...(contextLength ? { contextLength } : {}),
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
      };
    })
    .filter(Boolean);
}

// /models may be publicly readable. Only a successful small authenticated chat
// completion proves a user-created Portal key is usable. Keep this body tiny;
// callers supply timeout/proxy handling at their own boundary.
export function createNousApiKeyProbe(apiKey) {
  return {
    url: NOUS_CHAT_COMPLETIONS_URL,
    options: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NOUS_VALIDATION_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    },
  };
}

export function classifyNousApiKeyProbe(status) {
  if (status >= 200 && status < 300) return { valid: true, error: null };
  if (status === 401 || status === 403) return { valid: false, error: "Invalid or inactive Nous Portal API key" };
  if (status === 402) return { valid: false, error: "Nous Portal key could not be verified: payment or subscription access is required" };
  if (status === 429) return { valid: false, error: "Nous Portal key could not be verified: rate limited; try again later" };
  return { valid: false, error: `Nous Portal key could not be verified (upstream returned ${status})` };
}
