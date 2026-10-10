# Unified Fitness (Expo, React Native, TypeScript)

## Run it

From this existing `mobile/` directory:

```bash
yarn install --frozen-lockfile
yarn start
```

Checks: `yarn typecheck`, `yarn test`. Tests use Node's built-in SQLite and
TypeScript stripping (verified on Node 25.6.1). SDK patch compatibility drift is open;
physical iOS/Android offline restart checks remain pending. See `../docs/development-plan.md`.

For the first iPhone preview, install Expo Go compatible with SDK 57. Sign in to
Expo Go and run `yarn expo login` on the Mac using the same Expo account. Keep both
on the same Wi-Fi, run `yarn expo start --go --lan`, then scan the terminal QR with
the iPhone camera. Allow Local Network access. Port 8081 may be occupied by Docker;
accept another port instead of stopping unrelated services.

Test onboarding, typed meal save, manual correction, and reopening the project.
Expo Go preview is not full offline cold-start or background-GPS sign-off.

In `app.json`, set `"userInterfaceStyle": "light"` so the paper theme is never inverted.

## Native builds (setup prepared; installation not yet verified)

Expo Go stays available with `yarn start`. Native work uses a separate dev client:

```bash
yarn native:generate
yarn ios:device
yarn android:device
yarn start:dev
```

Run platform build commands only after installing full Xcode (iOS) or Android
Studio/SDK/JDK (Android). iPhone requires trusted device, Developer Mode if required,
and an Apple Account/Personal Team configured in Xcode. Free provisioning expires
after seven days; TestFlight/store distribution needs paid membership. Current Mac
has Command Line Tools only, so no signed native build/install is verified yet.

Generated native trees are ignored; app config/dependencies are source of truth.
Do not use a clean rebuild over existing native edits without confirmation. The
standalone app has separate storage from Expo Go; preview records do not migrate
automatically. GPS and health integrations are not implemented yet.

## Data

Profile and submitted meals persist locally in SQLite. Typed food logs can have
unknown nutrition; tap a saved meal to add or correct manual values. The provider
does not seed mock meals or use the old onboarding/seed switches. Food log's History
opens calendar-day records without changing Today. Export creates a versioned JSON
copy of your profile and all saved meals; choose Save to Files for a local copy.
Exported files contain personal information. History/share-sheet/offline behavior
still needs device verification. Activity rings remain explicitly labeled demo data.
Nutrition foundation uses additive schema v4: jobs persist with meals, worker leases
and revisions reject stale results, and generic estimates have a versioned local
cache. Unknown carbs/fat show a dash. New logs have no custom-macro entry requirement;
existing values/future estimates can be corrected. A gated foreground Supabase worker
and bounded OpenAI adapter are implemented. Production defaults remain off;
founder development preview is enabled under an approved US$1 total test cap.
Photo capture/gallery, private-upload/vision and in-place result-screen code is
implemented on the feature branch; production photo flags remain off until review.
Camera and model quality require physical-device testing. Voice now has foreground
30-second document-backed recording, private online transcription and editable review
feeding the existing cached text meal draft. Type left, camera centre, voice right.
Voice uses the standard native AAC preset and Done to finalize audio. Expo Go native
clips are validated then copied to project-scoped documents before queueing; failed
finalization can retry the same clip. Founder reports visible speech text on iPhone;
accuracy, full save/reopen/offline and Android gates remain pending. Camera opens a
live picture view directly with Gallery bottom-right; no source chooser.
Seed/test food data is not inserted into local app logs.

Supabase public config is validated; migration and nutrition-estimate v1 are deployed.
Hosted permission/JWT checks pass. Guest auth and live OpenAI text smoke now pass;
idempotent/normalized/cross-user cache checks reuse one inference reservation.
Broader meal accuracy and physical-device behavior are not validated.
Use `mobile/.env.example` as the template
for `mobile/.env.local`; fill only the publishable/legacy anon client key there.
Project URL is public. Service-role and model keys belong only in backend secrets,
never EXPO_PUBLIC variables or chat. Dotenv files are ignored; do not reset or
uninstall Expo Go to test the migration. Keep EXPO_PUBLIC_NUTRITION_ENABLED=false
unless guest-auth/model-budget setup is explicitly approved. Founder preview uses
an ignored mobile/.env.development.local override containing only the enabled flag;
public URL/key remain in .env.local. `yarn check:config` validates public config
without printing credentials; normal Expo scripts run it first.

Backend code: `supabase/migrations/` and `supabase/functions/nutrition-estimate/`.
The function retains JWT verification, checks user identity, and serves shared cache
or coalesces durable requests. Monthly model budget defaults zero; model calls also
require server-only OPENAI_API_KEY, NUTRITION_MODEL, MODEL_MAX_CALL_USD and explicit
MODEL_API_ENABLED=true. Maximum call cost must be a reviewed upper bound for the
chosen model/token limits. Current snapshot: gpt-5-mini-2025-08-07 (code default).
Adapter uses strict JSON and store=false; abuse-monitoring retention may still apply.
Do not turn flags on before privacy/budget approval. Inline image adapter support
is wired through owned JPEG/digest/private upload ingress on the photo branch.
To activate after reviewed deployment: server PHOTO_API_ENABLED=true, client
EXPO_PUBLIC_PHOTO_ESTIMATES_ENABLED=true. Optional EXPO_PUBLIC_NUTRITION_FUNCTION
selects a same-project preview function. Existing production text function is not
changed by merely checking out this branch. Photo outputs cap at 4096 tokens and
reserve at least $0.02; total testing cap remains $1. Typed text stays at 2048.

Photo processing consent explains upstream retention/portion limitations. Local
photos are sanitized/re-encoded and stored in app documents. Uploads are deleted
after processing attempts; orphans older than a day are pruned on next owner sync,
not guaranteed removed during inactivity. Remove local photo keeps logged nutrition.
JSON exports include photo references/identified foods but do not back up binary media.

Backend checks: `npm exec --yes --package=deno@2.9.6 -- deno check
supabase/functions/nutrition-estimate/index.ts` from repo root. Postgres tests use
`supabase/tests/bootstrap.sql`, migration, then `supabase/tests/nutrition.sql` in an
isolated fresh database, never on the hosted project. Bootstrap files emulate
Supabase roles/auth/storage for tests and must not be applied to production.

Live smoke (explicit spending approval required): from mobile, run
`NUTRITION_SMOKE_APPROVED=true node --env-file=.env.local scripts/smoke-nutrition.mjs`.
This creates anonymous test users and can call OpenAI, then checks same-job and
normalized/cross-user shared-cache reuse. Never run automatically in CI. Approved
test cap is US$1 total; $0.01 is reserved conservatively per model call, not measured
invoice spend. Only the current UTC month has a positive limit; new months do not
renew this approval.

Voice preview uses `voice-transcribe-preview` with JWT verification, private
`meal-voice` storage and backend-only pinned `gpt-4o-mini-transcribe-2025-12-15`.
Server `VOICE_PREVIEW_API_ENABLED` and development-only `EXPO_PUBLIC_VOICE_ENABLED`
are enabled for founder testing; production client defaults off. Transcription reserves
$0.04 conservatively against the existing total $1 cap, not a separate budget.
`MODEL_API_ENABLED` is also required. Review speech text before macro estimation;
short synthetic clips had word errors and do not establish Hindi/English accuracy.
JSON export includes voice state/transcripts/references, not binary media.

Explicitly approved synthetic-audio smoke only:
`VOICE_SMOKE_APPROVED=true node --env-file=.env.local scripts/smoke-voice.mjs <approved.m4a>`.
Never run this automatically in CI or use personal recordings without consent.

## Structure

```
App.tsx                      fonts, providers, onboarding vs main
src/theme.ts                 colours, fonts, radii from the HTML
src/types.ts
src/data/mock.ts             user, activity, meals, usuals, photo results
src/lib/targets.ts           calories, protein, fibre from goal and body
src/lib/format.ts
src/context/AppContext.tsx   profile, meals, derived totals
src/components/              Ring, MacroBar, MealRow, Icons, ui (onboarding parts)
src/screens/                 Onboarding, Home, Log, Main (swipe pager)
```
