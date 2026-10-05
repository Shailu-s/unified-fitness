# Unified Fitness (Expo, React Native, TypeScript)

## Run it

From this existing `mobile/` directory:

```bash
yarn install --frozen-lockfile
yarn start
```

Checks: `yarn typecheck`, `yarn test`. Tests use Node's built-in SQLite and
TypeScript stripping (verified on Node 25.6.1). SDK compatibility checks pass;
physical iOS/Android offline restart checks remain pending. See `../docs/build-plan.md`.

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
Nutrition foundation uses additive schema v2: jobs persist with meals, worker leases
and revisions reject stale results, and generic estimates have a versioned local
cache. Unknown carbs/fat show a dash. New logs have no custom-macro entry requirement;
existing values/future estimates can be corrected. A gated foreground Supabase worker
and bounded Gemini adapter are prepared; neither is live by default. Photo capture,
upload/vision and voice are not implemented yet. Test values exist only in tests.

Supabase public config is validated; migration and nutrition-estimate v1 are deployed.
Hosted permission/JWT rejection checks pass; model calls remain explicitly disabled.
Guest auth and approved model/privacy/budget configuration still need setup.
Use `mobile/.env.example` as the template
for `mobile/.env.local`; fill only the publishable/legacy anon client key there.
Project URL is public. Service-role and model keys belong only in backend secrets,
never EXPO_PUBLIC variables or chat. Dotenv files are ignored; do not reset or
uninstall Expo Go to test the migration. Keep EXPO_PUBLIC_NUTRITION_ENABLED=false
until guest-auth/model-budget setup and authenticated testing are approved. `yarn check:config`
validates public credentials without printing them; normal Expo scripts run it first.

Backend code: `supabase/migrations/` and `supabase/functions/nutrition-estimate/`.
The function retains JWT verification, checks user identity, and serves shared cache
or coalesces durable requests. Monthly model budget defaults zero; model calls also
require server-only GEMINI_API_KEY, NUTRITION_MODEL, MODEL_MAX_CALL_USD and explicit
MODEL_API_ENABLED=true. Maximum call cost must be a reviewed upper bound for the
chosen model/token limits. Do not turn flags on before privacy/budget approval.

Backend checks: `npm exec --yes --package=deno@2.9.6 -- deno check
supabase/functions/nutrition-estimate/index.ts` from repo root. Postgres tests use
`supabase/tests/bootstrap.sql`, migration, then `supabase/tests/nutrition.sql` in an
isolated fresh database, never on the hosted project. Bootstrap files emulate
Supabase roles/auth/storage for tests and must not be applied to production.

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
