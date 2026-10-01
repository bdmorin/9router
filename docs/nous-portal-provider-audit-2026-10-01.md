# Nous Portal provider audit and integration handoff

Date: 2026-10-01
Audit branch: `wt/nous-provider-v2-audit`
Candidate: [decolua/9router#3363](https://github.com/decolua/9router/pull/3363), commit `b08f006324ebc5e355a871fb46f8f5bd34f1acce`
Current audit baseline: `a99cf57239ff778b61e434c2786009d5ed1c412c` (`# v0.5.95`)

## Decision

**REUSE SELECTED COMPONENTS; DO NOT CHERRY-PICK OR REBASE THE PR AS-IS.**

PR #3363 is a focused, static-key-only implementation candidate, not a working current integration. It is one commit on an August baseline (`699edac3273e13d4744bc46f6082618f08560702`) and current 9Router has 271 commits after that base. A dry merge against the audit baseline conflicts in capability resolution, generated registry imports, connected-provider model discovery, suggested-model filtering, provider baseline data, and a deleted golden snapshot. That is the proper signal to reconstruct the small useful units against current seams, not weld an archaeological artifact onto the reactor.

Reusable ideas:

1. A first-class `nous` registry entry using the documented OpenAI-compatible inference base.
2. Static Portal API-key auth only, stored in the normal 9Router provider credential flow.
3. An authenticated minimal chat-completions probe for key validation, because `/models` cannot prove authentication when it is publicly readable.
4. Dynamic model discovery with router-qualified IDs such as `nous/<upstream-model-id>`, so vendor-slash upstream IDs are not misparsed as provider IDs.
5. Conservative model filtering and fixture-based tests.

Not reusable without redesign/current evidence:

1. The old registry index edit: `open-sse/providers/registry/index.js` is now generated and must be regenerated, never hand-merged.
2. The old capabilities and reasoning edits: current capability resolution gained catalog overlays and additional supported formats after the candidate was written.
3. Candidate assertions that Hermes 4 lacks tools, has a 131072 context, a 32000 output cap, and accepts `reasoning: { enabled, effort }`. The current public source confirms Hermes 4 is chat/reasoning-oriented and not recommended for tool loops, but does not publish those exact transport/capability fields for third-party static keys.
4. Candidate seed models and `:free` validation model. Portal routing/catalog/pricing are dynamic; no current credential-backed public evidence was available in this audit.
5. The deleted golden transport snapshot and stale baseline snapshots: regenerate from current test behavior only.

## Revision log / correction of prior assumptions

| Revision | Status | Evidence |
| --- | --- | --- |
| “Implement a third-party OAuth/device flow by using `hermes-cli`.” | **RETRACTED** | The Nous third-party auth guidance states that external applications use a static Portal API key (or beta x402), and that Portal does not provide general OAuth 2.0, third-party client registration, shared Portal SSO/cookies, or sanctioned reuse of Hermes state. |
| “No existing static-key implementation exists.” | **RETRACTED** | Public PR [#3363](https://github.com/decolua/9router/pull/3363) exists and is explicitly static-key-only. It was initially overlooked. |
| “PR #3363 can be merged/cherry-picked.” | **REJECTED** | Dry merge has six content conflicts plus one modify/delete conflict; the current branch has moved 271 commits. |
| “Anonymous `/models` validates a supplied key.” | **REJECTED** | A public endpoint cannot distinguish a valid key from arbitrary bearer text. Use authenticated inference. |

## Source-linked contract

| Claim | Confidence | Source / audit interpretation |
| --- | --- | --- |
| The external-app endpoint is `https://inference-api.nousresearch.com/v1` and is OpenAI-compatible. | **VERIFIED** | [Nous third-party auth guidance](https://github.com/NousResearch/hermes-agent/blob/main/skills/autonomous-ai-agents/hermes-agent/references/portal-auth-for-third-party-apps.md), [Subscription Proxy allowed paths](https://hermes-agent.nousresearch.com/docs/user-guide/features/subscription-proxy). |
| 9Router v1 must use a user-created Portal API key as a bearer. | **VERIFIED** | [Nous third-party auth guidance](https://github.com/NousResearch/hermes-agent/blob/main/skills/autonomous-ai-agents/hermes-agent/references/portal-auth-for-third-party-apps.md). |
| No third-party OAuth, shared Hermes credential, browser session, Tool Gateway, or local credential broker belongs in this provider. | **VERIFIED** | Same guidance; the subscription proxy is a separate Hermes-owned credential-attaching service, not a 9Router integration contract. |
| Chat completions streaming/non-streaming, completions, embeddings, and models are Portal proxy paths. | **VERIFIED** | [Subscription Proxy allowed paths](https://hermes-agent.nousresearch.com/docs/user-guide/features/subscription-proxy). v1 provider scope remains chat completions + models only. |
| Portal’s catalog and per-model routing change over time. | **VERIFIED** | [Nous Portal integration guide](https://hermes-agent.nousresearch.com/docs/integrations/nous-portal). Do not bake pricing or a global catalog into immutable source claims. |
| The exact static-key `/models` auth behavior is public/no-auth. | **UNCERTAIN** | PR #3363 says it is public, but that is contributor evidence, not the cited third-party contract. Discovery must work whether it is public or authenticated; it must never serve as credential validation. |
| `reasoning: { enabled, effort }` is the public static-key wire contract. | **UNCERTAIN** | PR #3363 derives this from a first-party-client observation. No official public third-party source located in this audit establishes the field or accepted effort values. |
| Hermes 4 tool calling is unsupported in the Portal static-key API. | **LIKELY but unverified for this integration** | The official Portal guide says Hermes 4 is chat/reasoning oriented and not recommended for rapid tool-calling loops. It does not state the third-party API rejects tools. Keep tool availability conservative until a current sanctioned test/source proves it. |

## Candidate provenance and license assessment

* Candidate author: GitHub user `dungartoriaaa` (commit author `Dũng A Tô Ri A <247336248+dungartoriaaa@users.noreply.github.com>`).
* Candidate commit: `b08f006324ebc5e355a871fb46f8f5bd34f1acce`; no Git signature and no `Signed-off-by` trailer were present in the fetched commit metadata.
* Repository license: MIT, copyright “decolua and contributors” ([LICENSE](../LICENSE)).
* Assessment: **LIKELY reusable under the repository’s contribution/license model**, with clear attribution in the implementation commit/body to PR #3363. This audit cannot independently prove the contributor’s authorship authority; do not present candidate implementation details as official Nous documentation.

## Current integration seams

| Concern | Current seam | Required implementation behavior |
| --- | --- | --- |
| Provider registration | `open-sse/providers/registry/nous.js`; regenerate `open-sse/providers/registry/index.js` with the repository generator | Add an `apikey`-only provider. `transport.baseUrl` is chat completions. No OAuth config, refresh token, credential import, or Tool Gateway fields. |
| Provider configuration | `open-sse/providers/index.js`, `open-sse/config/providers.js`, `open-sse/config/providerModels.js` | Verify generated registry flows into `PROVIDERS`; provide only evidence-backed seed IDs, or omit fragile seeds and depend on connected discovery. |
| Validation before saving | `src/app/api/providers/validate/route.js` | Add an explicit `nous` branch before generic OpenAI-compatible fallback. POST one minimal non-streaming chat request with the supplied key. A successful 2xx is valid; 401/403 are invalid/revoked; 402/429/5xx/network failures are inconclusive errors, not accepted credentials. Use timeout/abort. |
| Validation of saved connection | `src/app/api/providers/[id]/test/testUtils.js` (`testApiKeyConnection`) | Reuse the same probe builder and proxy-aware fetch path. Persist active/error status without logging the key or response body. Do not invoke OAuth refresh. |
| Connected model discovery | `src/app/api/providers/[id]/models/route.js` (`PROVIDER_MODELS_CONFIG`) | Fetch `/models` with the connection bearer. Normalize only supported chat candidates; return IDs as `nous/<upstream-id>` plus `upstreamModelId`. Preserve explicit failure/warning semantics; do not infer that fetch success proves key validity. |
| Dashboard suggestions | `src/shared/utils/providerModelsFetcher.js`, `src/app/api/providers/suggested-models/filters.js` | Do not advertise a public, unauthenticated full catalog as “free.” Add a filter only when current catalog fields/pricing semantics are test-fixtured and stable; otherwise omit `modelsFetcher` in v1. |
| Reasoning | `open-sse/providers/capabilities.js`, `open-sse/providers/thinkingLevels.js`, `open-sse/translator/concerns/thinkingUnified.js` | First preserve ordinary OpenAI-compatible behavior. Add a Nous-specific wire transform only after official contract evidence or an opt-in user-key integration test confirms request and streaming response behavior. A static key must never be used in fixtures. |
| Tool calls | `open-sse/providers/capabilities.js`, existing OpenAI translation/execution path | Mark individual models tool-capable only with catalog/contract evidence. Static provider registration alone must not invent tool support. |

## Implementation test matrix

| Test ID | Layer | Test / fixture | Expected result |
| --- | --- | --- | --- |
| N-01 | registry | Import registry and resolve `nous` / aliases. | API-key-only entry, documented base URL, no `PROVIDER_OAUTH.nous`. |
| N-02 | route parse | Parse `nous/<vendor/model>` where upstream ID contains `/`. | Provider remains `nous`; upstream model is preserved byte-for-byte. |
| N-03 | initial validation | Mock chat probe 2xx. | `{ valid: true }`; one POST, bearer header, `stream:false`, minimal token count. |
| N-04 | initial validation | Mock 401 and 403. | Invalid/revoked message; never call `/models`. |
| N-05 | initial validation | Mock 402, 429, 5xx, timeout/network error. | Explicit inconclusive/operational error, never “valid.” |
| N-06 | saved test | Mock connection test success/failure through `fetchWithConnectionProxy`. | Same probe semantics, correct persisted `testStatus`, no refresh attempt. |
| N-07 | discovery | Mock text, embedding-only, image-only, malformed, and namespaced catalog entries. | Supported chat entries only; each output has router-qualified `id` and original `upstreamModelId`. |
| N-08 | discovery auth | Mock public 200 `/models` with a junk bearer. | Results may display, but validation tests still require chat inference. |
| N-09 | streaming | Mock OpenAI-compatible SSE response through default executor. | Chunks/usage/tool-neutral response preserve current gateway behavior. |
| N-10 | reasoning | Contract-backed fixture for every enabled/disabled effort value. | No proprietary `reasoning` transform until the fixture is backed by sanctioned evidence. |
| N-11 | tools | Contract-backed tool-call and tool-result stream fixture. | Enable tools only after request and response round-trip pass. |
| N-12 | regressions | `npx vitest run unit/nous-provider*.test.js`, registry/alias baseline scripts, `npx eslint .`, `npm run build`. | All newly added tests green; any pre-existing suite failures classified with baseline verifier. |
| N-13 | optional live | User-owned revocable static key, explicit bounded-cost approval, no log capture. | One validation probe, one non-streaming text chat, one streaming text chat, and (only if contract-backed) reasoning/tools. Otherwise explicitly skipped. |

## Security gates

1. Never read/import `~/.hermes/auth.json`, browser/session state, Hermes CLI state, or Tool Gateway credentials.
2. Never add OAuth routes/config, refresh tokens, device codes, client IDs, or browser automation for `nous`.
3. Keep API keys out of logs, fixtures, snapshots, error payloads, commit messages, and this audit.
4. Bound validation requests with timeout and a minimal response. Treat auth failures separately from billing/rate-limit/service failures.
5. Do not use dynamic catalog pricing/availability as a security or authorization decision.

## Reproducible audit evidence

Commands run from the isolated audit worktree:

```text
gh pr view 3363 --repo decolua/9router --json ...
git fetch upstream pull/3363/head:refs/remotes/upstream/pr/3363
git diff --check master...upstream/pr/3363
git merge-tree --write-tree HEAD upstream/pr/3363
git show -s --format='...' upstream/pr/3363
```

Results: candidate diff has 17 files / 731 insertions / 1 deletion and passes `git diff --check`; dry merge failed with the conflicts recorded above. This is an audit/design artifact only: no Nous credentials were used, no live upstream inference was claimed, and no provider code was adopted in this commit.
