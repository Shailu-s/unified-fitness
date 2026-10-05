# 005: Authenticated Supabase estimation boundary

Date: 2026-10-05
Status: Live text smoke/caching verified under approved US$1 cap; physical-device and photo quality gates pending

## Decision

Use Postgres for shared, model-versioned cache and durable per-owner requests. A service-only claim RPC serializes same-key work with advisory locks, checks idempotency, coalesces concurrent requests, enforces 100 new request IDs per owner/day, and reserves a conservative maximum per-call cost against a monthly ledger. Monthly budget defaults to zero. Reservations are not refunded after uncertain network/model failures; this intentionally stops earlier instead of risking an overrun. The declared maximum call cost must be validated against the pinned model's pricing and enforced token/input bounds before any live inference is approved.

Shared cache and budget tables have RLS enabled and no client read/write policies. Clients may read only their own request status; privileged RPC execution is limited to service_role. The meal-photos bucket is private, limited to 4 MiB JPEG/PNG/WebP inputs, and owner-folder upload/read/delete policies are defined for later photo work. Photos are not uploaded by this slice.

The Edge Function retains platform verify_jwt = true and additionally validates the user token with Supabase Auth. Owner identity never comes from the request body. Bounded JSON input accepts only client ID, text input type, meal description and portion. Server computes the cache key and validates all model results. Generic error codes, not keys/payloads, cross the boundary. Cached results require no model call; pending requests retry via durable state/leases. Processing is request-driven and bounded, not an autonomous forever-running server worker.

Founder selects OpenAI. The adapter pins gpt-5-mini-2025-08-07 and uses Responses API strict JSON, low reasoning effort, max_output_tokens=2048, no tools and store=false. It rejects refusal/incomplete/empty/invalid results and supports one bounded inline JPEG/PNG/WebP image for later N3 integration, not public/arbitrary image URLs. HTTP requests never put credentials in URL or payload. Range/assumption validation remains independent of the provider schema.

Server inference is disabled unless MODEL_API_ENABLED=true, OPENAI_API_KEY is present, NUTRITION_MODEL matches the pinned snapshot (the code default), and a finite positive MODEL_MAX_CALL_USD is configured. A positive approved monthly nutrition_budgets limit is additionally required. Official standard rates are $0.25/1M input and $2/1M output tokens (reasoning included); quality and actual token usage require a bounded live evaluation. Existing OpenAI account ownership is not approval to spend. store=false disables Responses application storage, not abuse-monitoring retention. No private photo has been sent to OpenAI.

## Mobile bridge

Supabase JS 2.117.2 (2026-09-25), expo-secure-store 57.0.4 (2026-09-11) and URL polyfill 4.0.0 (2026-07-14) are pinned. Guest auth avoids mandatory signup, but the owner must enable anonymous sign-ins and address abuse protections. Sessions use OS SecureStore via bounded Unicode-safe chunks and atomic manifest switching; no plaintext SQLite token storage. Operations are serialized, failed replacement preserves the old session, and runtime tests use an in-memory adapter rather than claiming native encryption verification.

EXPO_PUBLIC_NUTRITION_ENABLED defaults false. Until explicit activation, app startup/logging never registers a remote guest or calls inference. When enabled, a single foreground worker sends text jobs after local acknowledgement, persists results/errors/deferred states, retains idempotent job IDs, and skips unsupported photo jobs. Local revision/lease checks still protect corrections. Public config validation rejects secret/service-role keys and is run before standard Expo start/build scripts. Env values are never displayed by the checks.

## Verification and deployment gates

54 Node tests pass, plus real Postgres RPC/budget/coalescing/RLS/photo-owner tests using isolated auth/storage fixtures. The Deno entry point and shared TypeScript check, SDK compatibility, and both mobile bundles pass. Postgres fixture tests are not a deployed Supabase end-to-end test. The test container was stopped without deleting its data or touching other containers.

At the local-code checkpoint, only a read-only auth-settings HTTP check was made against the owner's project: public config works; anonymous sign-in was disabled at that time. No remote schema, bucket, user, model call or billing change was created. Owner deployment access/approval, guest-auth setup, model/privacy/budget approval, and real iPhone/Android testing remain required. Camera/gallery, actual image persistence/upload/recognition, media retention/export, and rings/GPS are follow-on work in the approved plan.

## Hosted deployment checkpoint

Owner explicitly approved creating the nutrition tables/private photo bucket and authenticated function with model calls disabled. Supabase CLI 2.118.0 was pinned (published 2026-09-25). After owner browser login and Keychain permission, the empty target was inspected, the migration dry-run reviewed, and standard db push applied only migration 202610050001 with no seeds/custom roles/vault updates. Server MODEL_API_ENABLED=false was set explicitly before deploying nutrition-estimate v1.

Management checks report function ACTIVE and verify_jwt=true; remote migration history is up to date. All four tables have RLS enabled, authenticated callers have no shared-cache read/claim-RPC execution privilege, and the photo bucket is private with 4 MiB image limits. An unauthenticated HTTP call returned 401. A paused RPC check returned disabled and left request/cache/budget rows at zero. No guest signup, actual photo upload, inference or spending was performed. Anonymous auth remains disabled, and authenticated execution/paid-model quality still need separate approval/testing. CLI metadata is ignored; tokens and passwords were neither exposed nor committed.

## Approved live smoke checkpoint

Founder enabled anonymous sign-in, configured server-only OPENAI_API_KEY and explicitly approved US$1 total test spend. Only the current UTC month's budget was set to one dollar; future months keep the default zero and require new approval. Server inference is enabled with pinned model and $0.01 conservative per-call reservation. At published rates, bounded input plus 2048 total output/reasoning tokens (and at most one capped image in the future adapter) fit below the reservation. The ledger is conservative, not the actual OpenAI invoice.

Authenticated live text returned valid structured nutrition; same request ID, normalized repeated phrasing and a second guest returned identical results. Hosted verification showed one ready cache item, five completed request IDs and $0.01 reserved across two smoke runs: repeats did not consume another inference reservation. Three anonymous test users were created, with session tokens held only in process memory. The sample result has no independent nutrition reference and does not establish accuracy. No photo capture/upload/model processing occurred.

Live smoke script now requires NUTRITION_SMOKE_APPROVED=true, avoiding accidental paid test runs. A local ignored .env.development.local sets EXPO_PUBLIC_NUTRITION_ENABLED=true for founder preview only, without rewriting credential files or changing production defaults. Config guard loads that development override; Expo Go was restarted and the iOS preview bundle returned HTTP 200. Actual SecureStore/device estimates, corrections, offline/reopen and Android behavior remain founder gates.
