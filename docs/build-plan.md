# V1 build plan and progress

Updated: 2026-10-05

## Working agreement

Build one usable vertical slice at a time. Keep the existing Expo / React Native / TypeScript UI. SQLite is the local source of truth; network, models, accounts, and billing must never block a local log. Both iOS and Android, live GPS, export, and light gym logging remain V1 requirements. No deep strength analytics, social feed, or photo-first redesign.

Status: TODO / BUILDING / VERIFY / DONE / BLOCKED. DONE requires recorded verification; native behavior needs device evidence, not just unit tests.

Founder feedback loop: after every slice, run checks, launch a runnable version, and give Shailendra a short manual checklist. Wait for his feedback before starting the next slice; fix reported blockers first. First test device: founder's iPhone. Record device/build and reported results, never assume a pass. Preview setup: install SDK-57-compatible Expo Go, sign in to the same Expo account in CLI and phone, use the same Wi-Fi, and scan the dev server QR. First checkpoint: onboarding → save typed meal → correct manual nutrition → close/reopen project.

## Approved next phase: complete text + photo nutrition

Founder approves nutrition before rings and explicitly includes photo estimation in this phase. Supabase backend is now approved; native health/GPS work remains later. OpenAI is now the approved provider. Founder approves US$1 total initial testing spend. First authenticated text estimate and same/cross-user cache reuse pass; private-photo privacy/retention disclosure and broader quality/device checks remain pending.

### Nutrition phase implementation slices

| Slice | Deliverable | Acceptance gate |
|---|---|---|
| N1 — VERIFY | Shared nutrition data/queue/cache foundation | Additive migration, full-macro/unknown fields, text/photo input metadata, durable jobs/leases, local cache, revision/correction protection and status UI implemented. Photo metadata is tested; actual capture/durable files are a subsequent N3 gate. Founder migration/reopen check pending. |
| N2 — VERIFY ON PHONE | Backend + typed estimates | Live guest auth/OpenAI response, idempotent retry and normalized same/cross-user shared cache pass. One ready cache item/five distinct completed requests consume only one $0.01 reservation. US$1 total test cap approved; backend and local development worker enabled. Founder iPhone correction/offline/reopen and Android checks pending; nutrition accuracy not validated. |
| N3 — PR / DEVICE QA | Flagship camera/gallery + vision results | Implemented on feat/photo-nutrition: camera/system gallery, owned durable JPEG/EXIF stripping, private owner/job/digest uploads, non-food rejection, recognized foods/portion guesses, result screen/loading, correction/removal, terminal vs transient retry states. Photo API/client flags default off until reviewed deployment. Automated tests/bundles pass; actual camera/permissions/native persistence/live vision quality unverified. |
| N4 | Corrections, privacy, reliability and quality | Portion/food correction UX; late results cannot overwrite edits. Test offline capture, kill/reopen, denied camera access, model failure/timeouts, duplicate jobs, invalid outputs, image-size limits, and both OSes. Evaluate Indian mixed meals against known-portion/reference cases; do not claim validated photo accuracy without evidence. Update history/export for new nutrition data and document photo retention/export policy. |

Complete N1–N4 and founder checkpoints before moving to real rings/GPS. Each slice remains a meaningful commit/test handoff rather than one giant feature commit. Voice later feeds the same nutrition pipeline.

### Approved backend: Supabase (live text testing; capped spend)

Use Supabase: Postgres for shared estimates/jobs; TypeScript/Deno Edge Functions for bounded model orchestration; private Storage with ownership/RLS policies for photos; Auth for access control (guest sessions can avoid a mandatory signup screen). SQLite remains the local source of truth; server auth/upload/model calls never gate saving a local log. Use durable Postgres request/cache state and idempotent leased processing, not an in-memory queue or a request assumed to survive indefinitely. Current bounded processing is request-driven; retry/reopen recovers persisted work, not autonomous background execution. Supabase Edge runtime limits require bounded work; resizing happens on mobile, model inference uses an external API.

Founder selects OpenAI using an existing API account. Pin the initial adapter to gpt-5-mini-2025-08-07, which officially supports text/images/structured output; this is a stable initial choice, not a nutrition-accuracy claim. Use Responses API strict JSON, low reasoning effort, max_output_tokens=2048, no tools, and store=false. Runtime range/assumption validation remains mandatory; refusals and incomplete output fail soft. Inline image support is adapter-only until N3 secure capture/upload ingress is wired.

Published standard model rates: $0.25 per 1M input tokens and $2 per 1M output tokens, including reasoning. Provider API key and service credentials remain server-only; use OPENAI_API_KEY, never EXPO_PUBLIC_OPENAI_API_KEY. Require explicit test/monthly budget approval before real calls. API data is not used for training by default, but store=false does not remove abuse-monitoring retention (typically up to 30 days, with policy exceptions). Supabase free tier can pause after inactivity; local logs remain usable and uncached estimates wait safely.

Sources: https://developers.openai.com/api/docs/models/gpt-5-mini and https://developers.openai.com/api/docs/guides/your-data .

### Updated later-feature order

Recommendation: automatic nutrition estimates first. Existing meal persistence/edit/history UI can be reused and tested in Expo Go; there is no estimator backend/cache yet, so this is a medium-complexity feature, not a single model call. Reliable all-day rings on both platforms are harder: native health adapters, permissions, available data sources, deduplication, and cross-platform metric definitions must all work. Expo's foreground pedometer is a smaller/easier demo, not equivalent to full daily rings; background updates are unavailable and historical queries are iOS-only.

| Order | Work | Gate before calling it usable |
|---|---|---|
| 1 | Complete text + photo nutrition (N1–N4; 3.1/3.2/3.4) | Both inputs usable, durable and correctable; server/local caching, bounded costs, private photo handling, offline/failure recovery, and founder test gates complete. |
| 2 | Native health/GPS feasibility checkpoint (2.1 + spikes) | Resolve supported Mac/SDK route without blind installs. Prove health read permissions and locked-screen GPS on iPhone; obtain real Android/OEM test access early. Do not let nutrition/UI work defer this until launch. |
| 3 | Real steps/rings (2.3/4.1) | HealthKit/Health Connect behind one interface; real day totals, denial/unavailable states, no fake zero readings or double counting. Approve shared ring metrics before replacing demo UI. Proposed steps/active calories/exercise minutes; stand hours are not assumed equivalent. |
| 4 | Complete live GPS walks/runs (2.2) | Start/pause/resume/finish, route/distance/time persisted continuously, interruption recovery; actual locked-screen/background and battery/OEM tests on both OSes. |
| 5 | Voice logging (3.3) | Speech → reviewed transcript → same nutrition pipeline/cache, not a second estimator. Define supported languages and offline/failure fallback; preserve captured input and keep typing available. |

Supabase is approved. The text + photo nutrition phase still requires deployment access, model/provider selection and a hard API spending cap. Secrets stay server-side; endpoint needs validation and abuse/rate limits. Repeated normalized meal phrases must reuse shared estimates; personal corrections stay separate from global cache. Local storage remains source of truth. Nutrition phase and Supabase scope are approved; live deployment access and billable model calls remain unconfigured.

Founder explicitly prioritizes complete text + photo nutrition before the remaining dashboard tracking pillars. Photo accuracy limits and the later native GPS feasibility risk remain acknowledged. Each usable slice gets automated checks, one meaningful commit, founder testing, then the next slice.

## Scope and acceptance gates (IDs are stable, not execution order)

| ID | Slice | Status | Acceptance gate |
|---|---|---|---|
| 1.1 | Durable profile + typed meal logging + corrections | VERIFY | Save offline, kill app, reopen: profile and meal remain. Edits remain. Unknown nutrition is explicit. No seeded meals. |
| 1.2 | Date-based history + export | VERIFY | Today excludes previous days; browse older logs; export all local records without server access. |
| 2.1 | Native development builds on both platforms | BLOCKED | Install and launch iOS and Android builds; establish physical-device test matrix. |
| 2.2 | Durable live GPS recording | TODO | Start/pause/resume/finish walk; saved route survives interruption. Test background/locked-screen behavior on a real Xiaomi/Realme and iPhone; document failures and battery impact. |
| 2.3 | HealthKit / Health Connect adapters | TODO | Shared interface; permissions, denial, unavailable data, and refresh tested separately on each OS. No fabricated readings. Decide cross-platform ring definitions before implementation. |
| 3.1 | Async text estimates + local/shared cache | TODO | Raw meal saves immediately; uncached offline log waits durably. Extend nutrition to include carbs/fat alongside calories/protein/fibre. Normalize phrasing with explicit portions and versioned cache keys; shared repeated meals avoid new model calls. |
| 3.2 | Estimate correction and failure recovery | TODO | Validate model output, retry failed jobs, label estimates; manual edits win over late results. Personal corrections never silently poison shared cache. |
| 3.3 | Voice-to-text logging | TODO | Same durable text path; unavailable voice service offers typing, never blocks logging. |
| 3.4 | Photo nutrition estimation (first nutrition phase) | TODO | Durable capture/private upload, explicitly rough estimates with portion/context correction; evaluate Indian mixed-meal quality and cost before completing nutrition phase. |
| 4.1 | Unified real dashboard | TODO | Food totals, real activity, and recorded walks appear together; deduplicate imported/locally recorded workouts. Handle missing permissions/data honestly. |
| 4.2 | Light gym logging | TODO | Save basic exercises/sets/reps/weight offline; resume interrupted log. No volume math or muscle maps. |
| 5.1 | 14-day pilot with 5–10 target users | TODO | Record activation, repeat use, logging friction, reliability, and support feedback; collect consent, avoid sensitive analytics payloads. |
| 5.2 | Accounts and offline-safe sync | TODO | Local use works signed out; durable outbox, idempotent sync, conflict policy, account isolation, sign-out, and deletion verified. |
| 5.3 | Freemium billing + release hardening | TODO | Founder approves paid value/price. Restore purchases, entitlement grace, privacy disclosures, account deletion, export, and store requirements verified on both platforms. |

Pilot may be local-only; public release requires accounts/sync and approved monetization. Native feasibility work happens before further UI polish.

## Foundation: 1.1 verification

Implementation checklist (checked means implemented/automated checks passed, not physical-device sign-off):

- [x] SQLite schema and versioned initialization, including rollback/retry on migration failure.
- [x] Profile persists before onboarding completes.
- [x] Typed meal saves without nutrition or network.
- [x] Optional manual nutrition and corrections persist.
- [x] Stable IDs, full timestamps, and local calendar date.
- [x] Midnight/foreground refresh implemented; native lifecycle behavior still needs device verification.
- [x] No seeded food records; activity demo explicitly labeled.
- [x] Automated persistence, validation, correction, date-boundary, and failed-write tests.
- [x] TypeScript check and iOS/Android bundle checks.
- [x] Expo SDK dependency compatibility check (approved dependency alignment completed).
- [x] Founder reports saved meal data survives closing/reopening Expo Go on iPhone.
- [ ] Physical iOS cold-start/offline test.
- [ ] Physical Android cold-start/offline test.

## Previous slice: 1.2 verification

- [x] History opens separately from Today; previous/next day and Today shortcut.
- [x] Saved-day shortcuts and day-specific totals; empty days explicit, no fake records.
- [x] Corrections retain original date/identity; existing logs require no migration/reset.
- [x] Full persisted profile/meal snapshot; all days included, unknown nutrition preserved.
- [x] Versioned readable JSON; no demo activity or computed targets exported.
- [x] Export confirmation and native share-sheet integration; cancel/retry leaves source records intact.
- [x] SDK-compatible file/sharing dependencies pinned, both older than seven days.
- [x] 18 automated tests pass in Asia/Kolkata and America/New_York; typecheck, SDK compatibility, iOS/Android bundles pass.
- [ ] Founder iPhone history navigation and editing test, including swipe-down dismissal (not sideways back navigation).
- [ ] Founder iPhone share-sheet cancel/retry and Save to Files test.
- [ ] Founder offline browse/export test with the app already loaded.
- [ ] Physical Android history/share-sheet test.

### Founder checklist for 1.2

1. Reload the existing Expo Go project; swipe left to food log. Existing meals should remain.
2. Tap History: Today shows existing meals. Previous shows yesterday's real records or an empty state; Back to today restores today's records. No synthetic older records are created.
3. Tap a meal in History; change its description and save. Close History: today's record updates if it was a today meal. Older corrections remain on their original day.
4. Tap Export: cancel once, retry, Continue, then Save to Files → On My iPhone. Inspect the JSON for your profile and all meals, including unknown nutrition as null. It contains personal information; no need to send the file to the assistant.
5. With the project already loaded, disable network and repeat browsing/export to a local Files folder. This is not a full Expo Go offline cold-start test.
6. Report each pass/fail and any confusing UI. Do not start the next slice before feedback.

## Native build preparation: 2.1 (paused behind nutrition phase)

- [x] Founder has no paid Apple Developer membership; initial route is local Xcode/Personal Team, not an unapproved subscription.
- [x] SDK-compatible dev client and Android light-mode helper pinned to releases older than seven days.
- [x] Explicit Expo Go preview and separate native/device commands; no unrelated server stopped.
- [x] Non-destructive native generation prepared using pinned SDK-57 template; React versions preserved.
- [x] Legacy external-storage permissions blocked in source app config; local export does not need them.
- [x] Final SDK compatibility, typecheck, 24 tests, regenerated native projects, and both platform bundle checks. Generated plist/XML/Podfile syntax checks pass; no native compilation result implied.
- [ ] Full compatible Xcode installed, first-launch/platform setup completed, and signing configured locally.
- [ ] Actual iPhone native app compiled, installed, and launched.
- [ ] Android Studio/SDK/JDK and device/emulator available.
- [ ] Actual Android native app compiled, installed, and launched.

No native compile/install result claimed. Generated projects and JS bundles are not device builds. GPS follows after a native baseline is usable; health adapters remain a separate slice.

## Verification log

- Founder reports live text save→estimate works, but paneer/roti repeats produced 808/785 kcal and an interim failure. Hosted inspection: two distinct cache keys, one matching exact input “2 roti and 1 paneer curry”; one model_failed request; $0.04 reserved under original $1 cap. Need exact original description/portion fields before asserting equivalent-input cache failure. Deterministic worker test reproduces transient failure UI and locks bounded retrying behavior. Photo research/ADR 006 informs implementation; vendor precision/depth claims are not validation. Founder explicitly approved normal baseline push; remote main now dadbb2f. New photo branch/PR contains only feature changes, no auto-merge/production deployment. 69 automated tests pass: SDK-pinned image modules, privacy byte/path/digest/ownership/non-food tests and real SQLite+file reopen. TypeScript, Deno, SDK compatibility and both platform bundles pass. Remaining device/reference gates unchecked; no new paid image calls made.

- Founder added OPENAI_API_KEY only to server secrets, enabled/saved anonymous auth and explicitly approved US$1 total testing cap. Configure only the current UTC month at limit_usd=1; future months still default zero (no automatic renewal of this approval). MODEL_MAX_CALL_USD=0.01 reserves conservatively per call; bounded pinned-model text/image token costs fit this ceiling, but reservation is not measured invoice spend. Authenticated text smoke passed; same-job, normalized same-user and cross-user repeated results were identical. Ledger stayed $0.01 reserved with one ready cache/five completed request IDs across runs. First result for 2 roti + dal was 510 kcal with explicit 200 g dal/oil assumptions: no independent accuracy validation. Three test guest users were created; no personal photos/tokens were stored in Git. Live smoke script requires NUTRITION_SMOKE_APPROVED=true and is not part of automatic tests. Local development-only override enables mobile worker; public key file untouched, no production flag defaults changed. Expo Go restarted on 8082; iOS preview HTTP 200. 56 automated tests/typecheck and both bundles pass; founder phone tests remain pending.

- Founder selects existing OpenAI API. Gemini adapter replaced by pinned gpt-5-mini-2025-08-07 Responses adapter with strict JSON/store=false, bounded output and prepared inline-image support; photo ingress still not wired. 55 tests, TypeScript and Deno entry check pass. Function v3 ACTIVE with verify_jwt=true; HTTP 401 rejection still passes. Redeployed with MODEL_API_ENABLED explicitly false; no OpenAI calls, guest signup or spending. OPENAI_API_KEY must be added only to Supabase server secrets; test/monthly budget and authenticated device evaluation remain pending.

- Owner approved create-only deployment and completed Supabase CLI login/Keychain access. Target inspected empty before change. Migration 202610050001 applied; migration dry-run now up-to-date. nutrition-estimate v1 deployed ACTIVE, verify_jwt=true, and MODEL_API_ENABLED explicitly false. Hosted checks: all four tables RLS=true; private 4 MiB image bucket; authenticated role lacks cache SELECT and privileged claim EXECUTE; unauthenticated function call HTTP 401; paused RPC returns disabled with zero request/cache/budget rows. No guest user, image upload, model call or spend occurred. Anonymous sign-in is still disabled; authenticated end-to-end/device inference unverified. CLI metadata directories ignored; no login token/password stored in Git.

- N2 backend and mobile bridge implemented: 54 Node tests, isolated real Postgres RPC/coalescing/budget/RLS/storage-owner tests, Deno entry check, TypeScript, SDK compatibility and both mobile bundles pass. Public config was consumed only by runtime validation; key values were not shown. Read-only owner-project auth settings returned HTTP 200 and anonymous sign-in disabled. Remote deployment and live model tests have not run. Client worker, model switch and positive monthly budget all require explicit setup/approval; default is paused/zero budget.

- Supabase approved; owner provided public project URL. N1 local foundation implemented and verified with 39 tests, TypeScript, and iOS/Android JS bundle exports. Tests use fixtures, not live model data. Supabase CLI/Deno are absent; Docker is available. No remote migration, authentication or paid inference was executed. Dotenv files are now ignored; existing dotenv values were not read. Live backend and actual photo capture/upload/vision remain pending.

- Founder reports the current basic Expo Go testing works. Treat this as an aggregate preview-checkpoint pass, not proof of every optional export case, Android behavior, or standalone offline cold start. No native GPS/health data is connected yet.

- 2026-10-05: repository audited. Existing UI only; profile/meals in React state, activity/photo results mocked, text/voice placeholders. No existing roadmap or tests. Dependency installation completed using existing yarn lockfile.
- 2026-10-05: slice 1.1 implemented. `yarn typecheck` passed; `yarn test` passed all 10 real-SQLite tests; iOS and Android `expo export` succeeded; `git diff --check` passed. Tested with Node 25.6.1. These are JS/Hermes bundles, not signed native binaries or runtime validation.
- 2026-10-05: `yarn expo install --check` failed on pre-existing dependency versions: installed Expo 57.0.24 (checker expects ~57.0.26), react-native-safe-area-context 5.10.0 (expects ~5.7.0), react-native-svg 15.15.5 (expects 15.15.4). No automatic stack upgrade performed. Align approved, SDK-compatible versions after checking release age; rerun typecheck/tests/bundles/compatibility check.
- 2026-10-05: native verification blocked in this environment: `xcrun simctl` unavailable and `adb` not installed. No device force-stop/offline result claimed. Activity remains labeled demo; LLM, camera, voice, history browsing, and export are not implemented yet.

- 2026-10-05: founder approved dependency alignment. Pinned Expo 57.0.26, safe-area-context 5.7.0, SVG 15.15.4. SDK compatibility check, TypeScript, 10 tests, and both platform bundle exports passed again. Expo patch published 2026-09-29 (six days old); selected the SDK-checker's required patch instead of an older mismatched patch. Other newly pinned direct dependencies are older than seven days.
- 2026-10-05: founder requested a manual-testing checkpoint after every slice; first device is iPhone. Expo's Go page lists SDK 57, and the App Store listing shows Expo Go 57.0.9 / React Native 0.86. Some Expo setup documentation still describes the older TestFlight distribution route; verify the installed client version if launch fails. No phone result reported yet.

- 2026-10-05: Expo Go preview server started on port 8082 (8081 belongs to Docker). `/status` returned `packager-status:running`. CLI login and founder's first iPhone launch/manual feedback are still pending. Server availability is not phone runtime verification.

- 2026-10-05: CLI login verified; founder reports app opens successfully on physical iPhone in Expo Go. Launch gate passed. Onboarding completion, meal save/correction, reopen persistence, and offline behavior are not yet reported; slice 1.1 stays VERIFY.

- 2026-10-05: founder reports the saved meal data survived the requested reopen test on iPhone. Expo Go persistence checkpoint passed; full airplane-mode cold start, Android, and midnight behavior are not signed off.
- 2026-10-05: product feedback: no separate custom/manual calorie/protein logging feature needed. Current manual fields are tolerated for testing. Production primary flow remains text/voice → immediate durable save → async LLM/cache estimate. Keep hand-correction of estimates as the existing safety requirement, not mandatory nutrition entry or a standalone manual workflow.

- 2026-10-05: meaningful-commit workflow requested by founder. Logging foundation committed as `ccb0c3c`; no push. Slice 1.2 adds local history and full JSON export without resetting records. 18 tests passed under both India/New York time zones; TypeScript, SDK compatibility, and iOS/Android bundle checks passed. Native share-sheet and Files results still await founder feedback.

- 2026-10-05: founder reports back swipe fails from History to food log. Code inspection confirms History used the React Native default full-screen modal without swipe dismissal; slide animation alone is not a gesture. Enabled native page-sheet presentation plus swipe-down dismissal, retaining the Done button and same close callback. Two source-contract tests cover those declared props/callbacks (one failed before the change); they do not prove UIKit gesture behavior. Founder must retest swipe-down on iPhone; sideways edge-back is not introduced.
- 2026-10-05: founder asks to proceed to next slices and reports no paid Apple Developer membership. Native build route will be local Xcode/personal-team signing for initial iPhone testing, subject to free-provisioning limitations. Mac currently has Command Line Tools only; `xcodebuild -version` fails. Native compilation remains blocked until full Xcode is installed and device signing is available. Export testing remains pending, not assumed passed.

- 2026-10-05: native setup prepared. Dev client/system UI pinned; SDK-57 template pinned. Native iOS/Android projects generated and regenerated without clean/dependency upgrades, with expected legacy-storage removal markers in Android manifest. SDK compatibility, TypeScript, all 24 tests (18 functional data/export tests + 6 source/config contract tests), both JS/Hermes bundles, and plist/XML/Podfile syntax checks passed. App installation, real native compile, swipe-down gesture, GPS, and health integration are not verified or complete. Navigation configuration fix committed separately as `ae8d4f0`.

### Re-run automated checks

From `mobile/`:

```sh
yarn typecheck
yarn test
yarn expo export --platform ios --output-dir dist/ios
yarn expo export --platform android --output-dir dist/android
```

Tests use Node's built-in SQLite and TypeScript stripping. No extra test runner is required.

### Physical-device sign-off for 1.1

On both iOS and Android, with an installed compatible client/build:

1. Complete onboarding; confirm no seeded food logs.
2. Log `2 roti, 1 katori dal` without nutrition; confirm `Not estimated` and partial-total notice.
3. Edit the meal; enter calories, protein, and fibre including an explicit zero; save.
4. Disable network after the app/build is loaded. Add a second meal without nutrition.
5. Force-stop/terminate, reopen offline: profile, both meals, and correction remain. Do not uninstall or clear app storage.
6. Leave a saved meal unedited across midnight or background/reopen next day; Today excludes it. Historical browsing arrives in 1.2.
7. Record device/OS/build and pass/fail here. If the development client needs Metro to cold-launch, use an installed standalone development/release test build for the full offline cold-start check.

## Photo feature review and manual gates

Review the photo feature PR before replacing production nutrition-estimate. Existing schema/bucket is reused; no destructive migrations are required. After approved deployment set server PHOTO_API_ENABLED=true and client EXPO_PUBLIC_PHOTO_ESTIMATES_ENABLED=true. EXPO_PUBLIC_NUTRITION_FUNCTION can target an isolated preview function; never silently bypass JWT verification. Photo calls reserve at least $0.02 with 4096 output tokens; overall approved $1 cap is unchanged. Text retains 2048 tokens/$0.01 configured reservation.

- [ ] iPhone camera consent/permission granted and denied; gallery cancel creates no meal.
- [ ] Photo→local record/result screen, then live foods/macros and visible assumptions.
- [ ] Airplane Mode capture; kill/reopen; reconnect resumes same record/photo.
- [ ] Portion/food correction and numeric override survive restart; late result cannot overwrite.
- [ ] Same photo retry/idempotency and changed-photo/owner cache separation.
- [ ] Non-food/blurred image yields explicit no-estimate, not invented zero.
- [ ] Owner cannot access another owner's photo; upload cleanup/orphan next-sync checked live.
- [ ] Remove local photo preserves nutrition; export includes metadata, not image binaries.
- [ ] Repeat on Android physical phone; camera/SDK/native changes require real builds later.
- [ ] Evaluate known/weighed portions and Indian mixed meals, including oil/ghee; report errors rather than accuracy marketing.

## Next action

Founder reloads the existing Expo Go project without clearing data. Verify old logs/manual corrections remain, new meals save instantly and then estimate, portion edits persist, and unknown carbs/fat show a dash until available. Do not uninstall or reset the app.

Founder reloads Expo Go and tests immediate local save → automatic estimate, repeats a phrase, edits portion/corrects numbers, and captures an offline meal that estimates after reconnect/foreground. Prior unestimated logs may process when reopened; all requests stay inside the approved US$1 test cap. Treat numbers as estimates and inspect assumptions; do not mark photo/nutrition accuracy or Android/native behavior validated. After feedback, proceed to photo capture/private upload/vision within this nutrition phase before rings/GPS. Do not raise budget without separate approval.

Native installations remain paused until the researched compatible Mac/SDK route is approved. Keep health/GPS feasibility tests early and explicit; both native install gates remain incomplete. Export is a backup/data-ownership requirement, not an expanded daily feature.

## Blockers / decisions needed later

- iPhone preview launch and reopen persistence confirmed by founder; midnight/offline/Android checks remain pending.
- Xiaomi/Realme access and standalone iOS/Android builds needed for full offline/native verification.
- Slice 2.1: full Xcode and Apple Account/Personal Team signing are unavailable here; founder handles installation and credentials locally. Free provisioning expires after seven days. Android SDK/JDK/device access also required. Existing scaffold bundle ID must be checked during signing; ownership/availability not assumed.
- Health ring semantics: stand-hour data cannot be assumed equivalent across OSes.
- Live text testing enabled under US$1 total cap. Model quality, private-photo privacy/retention/capture/vision, account/sync behavior and paid tier remain incomplete; no additional spend approved.
