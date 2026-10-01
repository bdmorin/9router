import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NOUS_CHAT_COMPLETIONS_URL, NOUS_MODELS_URL } from "../../open-sse/services/nous.js";

const mocks = vi.hoisted(() => ({
  getProviderConnectionById: vi.fn(),
  getProviderConnectionByIdFromModels: vi.fn(),
  updateProviderConnection: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
  testProxyUrl: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { status: init.status || 200 }) },
}));
vi.mock("@/models", () => ({
  getProviderNodeById: vi.fn(),
  getProviderConnectionById: mocks.getProviderConnectionByIdFromModels,
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: mocks.getProviderConnectionById,
  updateProviderConnection: mocks.updateProviderConnection,
}));
vi.mock("@/lib/network/connectionProxy", () => ({ resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig }));
vi.mock("@/lib/network/proxyTest", () => ({ testProxyUrl: mocks.testProxyUrl }));

const originalFetch = global.fetch;
const { POST: validateProvider } = await import("../../src/app/api/providers/validate/route.js");
const { testSingleConnection } = await import("../../src/app/api/providers/[id]/test/testUtils.js");
const { GET: listProviderModels } = await import("../../src/app/api/providers/[id]/models/route.js");

const response = (status, body = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const request = () => new Request("http://localhost/api/providers/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ provider: "nous", apiKey: "portal-key" }),
});

describe("Nous Portal provider routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mocks.resolveConnectionProxyConfig.mockResolvedValue({});
    mocks.testProxyUrl.mockResolvedValue({ ok: true });
    mocks.updateProviderConnection.mockResolvedValue(undefined);
    const connection = { id: "nous-connection", provider: "nous", authType: "apikey", apiKey: "portal-key", providerSpecificData: {} };
    mocks.getProviderConnectionById.mockResolvedValue(connection);
    mocks.getProviderConnectionByIdFromModels.mockResolvedValue(connection);
  });

  afterAll(() => { global.fetch = originalFetch; });

  it("validates through a non-streaming chat probe and reports auth versus operational errors", async () => {
    global.fetch.mockResolvedValueOnce(response(401));
    expect(await (await validateProvider(request())).json()).toEqual({ valid: false, error: "Invalid or inactive Nous Portal API key" });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(NOUS_CHAT_COMPLETIONS_URL);
    expect(options).toMatchObject({ method: "POST", headers: { Authorization: "Bearer portal-key" } });
    expect(JSON.parse(options.body)).toMatchObject({ stream: false, max_tokens: 1 });

    global.fetch.mockResolvedValueOnce(response(429));
    expect(await (await validateProvider(request())).json()).toEqual({ valid: false, error: "Nous Portal key could not be verified: rate limited; try again later" });
  });

  it("reuses that probe for saved connections without OAuth refresh", async () => {
    global.fetch.mockResolvedValueOnce(response(200));
    const result = await testSingleConnection("nous-connection");
    expect(result).toMatchObject({ valid: true, error: null });
    expect(global.fetch).toHaveBeenCalledWith(NOUS_CHAT_COMPLETIONS_URL, expect.objectContaining({ method: "POST" }));
    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("nous-connection", expect.objectContaining({ testStatus: "active", lastError: null }));
  });

  it("discovers only chat-capable models with a slash-safe router ID", async () => {
    global.fetch.mockResolvedValueOnce(response(200, { data: [
      { id: "nousresearch/hermes-4-70b", architecture: { output_modalities: ["text"] } },
      { id: "vendor/embed", architecture: { output_modalities: ["embeddings"] } },
    ] }));
    const result = await listProviderModels(new Request("http://localhost"), { params: Promise.resolve({ id: "nous-connection" }) });
    expect(await result.json()).toMatchObject({
      provider: "nous",
      models: [{ id: "nous/nousresearch/hermes-4-70b", upstreamModelId: "nousresearch/hermes-4-70b" }],
    });
    expect(global.fetch).toHaveBeenCalledWith(NOUS_MODELS_URL, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer portal-key" }) }));
  });
});
