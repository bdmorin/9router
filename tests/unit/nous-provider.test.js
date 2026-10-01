import { describe, expect, it } from "vitest";

import REGISTRY from "../../open-sse/providers/registry/index.js";
import { PROVIDERS, PROVIDER_MODELS, PROVIDER_OAUTH } from "../../open-sse/providers/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { parseModel } from "../../open-sse/services/model.js";
import {
  NOUS_CHAT_COMPLETIONS_URL,
  NOUS_MODELS_URL,
  NOUS_VALIDATION_MODEL,
  classifyNousApiKeyProbe,
  createNousApiKeyProbe,
  normalizeNousModels,
} from "../../open-sse/services/nous.js";

describe("Nous Portal static-key provider", () => {
  it("registers an API-key-only OpenAI-compatible provider", () => {
    const entry = REGISTRY.find((candidate) => candidate.id === "nous");
    expect(entry).toMatchObject({
      id: "nous",
      category: "apikey",
      authType: "apikey",
      authModes: ["apikey"],
      aliases: ["nous-portal", "nous-research"],
    });
    expect(PROVIDER_OAUTH.nous).toBeUndefined();
    expect(PROVIDERS.nous).toMatchObject({
      format: "openai",
      baseUrl: NOUS_CHAT_COMPLETIONS_URL,
    });
    expect(PROVIDER_MODELS.nous.map(({ id }) => id)).toEqual([
      "nousresearch/hermes-4-70b",
      "nousresearch/hermes-4-405b",
    ]);
  });

  it("keeps vendor-slash model IDs intact behind the nous router namespace", () => {
    const models = normalizeNousModels({ data: [
      { id: "nousresearch/hermes-4-70b", name: "Hermes 4 70B", architecture: { output_modalities: ["text"] } },
      { id: "vendor/embedding", architecture: { output_modalities: ["embeddings"] } },
      { id: "vendor/image", architecture: { output_modalities: ["image"] } },
    ] });
    expect(models).toEqual([{
      id: "nous/nousresearch/hermes-4-70b",
      upstreamModelId: "nousresearch/hermes-4-70b",
      name: "Hermes 4 70B",
    }]);
    expect(parseModel(models[0].id)).toMatchObject({
      provider: "nous",
      model: "nousresearch/hermes-4-70b",
    });
  });

  it("uses ordinary OpenAI reasoning translation and does not fabricate a tool ban", () => {
    expect(getCapabilitiesForModel("nous", "nousresearch/hermes-4-70b")).toMatchObject({
      reasoning: true,
      thinkingFormat: "openai",
      tools: true,
    });
  });

  it("proves authentication with a bounded chat probe, never with model discovery", () => {
    const probe = createNousApiKeyProbe("redacted-key");
    expect(probe.url).toBe(NOUS_CHAT_COMPLETIONS_URL);
    expect(probe.url).not.toBe(NOUS_MODELS_URL);
    expect(probe.options.headers.Authorization).toBe("Bearer redacted-key");
    expect(JSON.parse(probe.options.body)).toEqual({
      model: NOUS_VALIDATION_MODEL,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    });
    expect(classifyNousApiKeyProbe(200)).toEqual({ valid: true, error: null });
    expect(classifyNousApiKeyProbe(401)).toMatchObject({ valid: false, error: expect.stringContaining("Invalid") });
    expect(classifyNousApiKeyProbe(402)).toMatchObject({ valid: false, error: expect.stringContaining("subscription") });
    expect(classifyNousApiKeyProbe(429)).toMatchObject({ valid: false, error: expect.stringContaining("rate limited") });
    expect(classifyNousApiKeyProbe(503)).toMatchObject({ valid: false, error: expect.stringContaining("503") });
  });
});
