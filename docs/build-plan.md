# V1 build plan and progress

Updated: 2026-10-05

## Working agreement

Build one usable vertical slice at a time. Keep the existing Expo / React Native / TypeScript UI. SQLite is the local source of truth; network, models, accounts, and billing must never block a local log. Both iOS and Android, live GPS, export, and light gym logging remain V1 requirements. No deep strength analytics, social feed, or photo-first redesign.

Status: TODO / BUILDING / VERIFY / DONE / BLOCKED. DONE requires recorded verification; native behavior needs device evidence, not just unit tests.

Founder feedback loop: after every slice, run checks, launch a runnable version, and give Shailendra a short manual checklist. Wait for his feedback before starting the next slice; fix reported blockers first. First test device: founder's iPhone. Record device/build and reported results, never assume a pass. Preview setup: install SDK-57-compatible Expo Go, sign in to the same Expo account in CLI and phone, use the same Wi-Fi, and scan the dev server QR. First checkpoint: onboarding → save typed meal → correct manual nutrition → close/reopen project.

## Sequence and acceptance gates

| ID | Slice | Status | Acceptance gate |
|---|---|---|---|
| 1.1 | Durable profile + typed meal logging + corrections | VERIFY | Save offline, kill app, reopen: profile and meal remain. Edits remain. Unknown nutrition is explicit. No seeded meals. |
| 1.2 | Date-based history + export | TODO | Today excludes previous days; browse older logs; export all local records without server access. |
| 2.1 | Native development builds on both platforms | TODO | Install and launch iOS and Android builds; establish physical-device test matrix. |
| 2.2 | Durable live GPS recording | TODO | Start/pause/resume/finish walk; saved route survives interruption. Test background/locked-screen behavior on a real Xiaomi/Realme and iPhone; document failures and battery impact. |
| 2.3 | HealthKit / Health Connect adapters | TODO | Shared interface; permissions, denial, unavailable data, and refresh tested separately on each OS. No fabricated readings. Decide cross-platform ring definitions before implementation. |
| 3.1 | Async text estimates + local/shared cache | TODO | Raw meal saves immediately; uncached offline log waits durably. Extend nutrition to include carbs/fat alongside calories/protein/fibre. Normalize phrasing with explicit portions and versioned cache keys; shared repeated meals avoid new model calls. |
| 3.2 | Estimate correction and failure recovery | TODO | Validate model output, retry failed jobs, label estimates; manual edits win over late results. Personal corrections never silently poison shared cache. |
| 3.3 | Voice-to-text logging | TODO | Same durable text path; unavailable voice service offers typing, never blocks logging. |
| 4.1 | Unified real dashboard | TODO | Food totals, real activity, and recorded walks appear together; deduplicate imported/locally recorded workouts. Handle missing permissions/data honestly. |
| 4.2 | Light gym logging | TODO | Save basic exercises/sets/reps/weight offline; resume interrupted log. No volume math or muscle maps. |
| 5.1 | 14-day pilot with 5–10 target users | TODO | Record activation, repeat use, logging friction, reliability, and support feedback; collect consent, avoid sensitive analytics payloads. |
| 5.2 | Accounts and offline-safe sync | TODO | Local use works signed out; durable outbox, idempotent sync, conflict policy, account isolation, sign-out, and deletion verified. |
| 5.3 | Freemium billing + release hardening | TODO | Founder approves paid value/price. Restore purchases, entitlement grace, privacy disclosures, account deletion, export, and store requirements verified on both platforms. |

Pilot may be local-only; public release requires accounts/sync and approved monetization. Native feasibility work happens before further UI polish.

## Current slice: 1.1

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

## Verification log

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

## Next action

iPhone Expo Go persistence checkpoint passed per founder. Next build slice: 1.2 (history and export), followed by another founder testing checkpoint. Do not expand standalone manual nutrition entry; it is temporary test UI until automatic estimates and optional estimate corrections exist. Full airplane-mode cold-start checks and Android verification still required before marking native durability DONE.

## Blockers / decisions needed later

- iPhone preview launch and reopen persistence confirmed by founder; midnight/offline/Android checks remain pending.
- Xiaomi/Realme access and standalone iOS/Android builds needed for full offline/native verification.
- Development signing/build account access for slice 2.1.
- Health ring semantics: stand-hour data cannot be assumed equivalent across OSes.
- LLM provider, backend hosting, auth/sync provider, and paid tier: not selected yet; record decisions when their slices start.
