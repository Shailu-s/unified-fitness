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
| 1.2 | Date-based history + export | VERIFY | Today excludes previous days; browse older logs; export all local records without server access. |
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

## Current slice: 1.2

- [x] History opens separately from Today; previous/next day and Today shortcut.
- [x] Saved-day shortcuts and day-specific totals; empty days explicit, no fake records.
- [x] Corrections retain original date/identity; existing logs require no migration/reset.
- [x] Full persisted profile/meal snapshot; all days included, unknown nutrition preserved.
- [x] Versioned readable JSON; no demo activity or computed targets exported.
- [x] Export confirmation and native share-sheet integration; cancel/retry leaves source records intact.
- [x] SDK-compatible file/sharing dependencies pinned, both older than seven days.
- [x] 18 automated tests pass in Asia/Kolkata and America/New_York; typecheck, SDK compatibility, iOS/Android bundles pass.
- [ ] Founder iPhone history navigation and editing test.
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

- 2026-10-05: meaningful-commit workflow requested by founder. Logging foundation committed as `ccb0c3c`; no push. Slice 1.2 adds local history and full JSON export without resetting records. 18 tests passed under both India/New York time zones; TypeScript, SDK compatibility, and iOS/Android bundle checks passed. Native share-sheet and Files results still await founder feedback.

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

Founder tests slice 1.2 history/export on iPhone using the checklist above. Fix feedback before slice 2.1 (native development builds and device matrix). Do not expand standalone manual nutrition entry; it remains temporary test UI until automatic estimates and optional corrections exist. Full airplane-mode cold-start and Android verification remain required release gates.

## Blockers / decisions needed later

- iPhone preview launch and reopen persistence confirmed by founder; midnight/offline/Android checks remain pending.
- Xiaomi/Realme access and standalone iOS/Android builds needed for full offline/native verification.
- Development signing/build account access for slice 2.1.
- Health ring semantics: stand-hour data cannot be assumed equivalent across OSes.
- LLM provider, backend hosting, auth/sync provider, and paid tier: not selected yet; record decisions when their slices start.
