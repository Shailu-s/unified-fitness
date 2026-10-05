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
existing values/future estimates can be corrected. Live model worker, photo capture,
upload/vision, and voice are not implemented yet. Test values exist only in tests.

Supabase is selected but not connected. Use `mobile/.env.example` as the template
for `mobile/.env.local`; fill only the publishable/legacy anon client key there.
Project URL is public. Service-role and model keys belong only in backend secrets,
never EXPO_PUBLIC variables or chat. Dotenv files are ignored; do not reset or
uninstall Expo Go to test the migration.

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
