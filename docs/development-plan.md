# Unified Fitness — Full Development Plan (V1 → Store Launch)

Updated: 2026-10-10
Owner: Shailendra (founder). Executed by: founder + AI agents.
Status of this document: **single master roadmap and live progress tracker**.
Current evidence, slice states, blockers and next actions live here; architecture
reasoning stays in `docs/decisions/`. The retired tracker's original detail remains
in repository history at application baseline `d41c8a9`.

This plan supersedes the "light gym logging" scope. Decisions below were made with
the founder on 2026-10-10 and are recorded in `CLAUDE.md`. During this progress
update the founder explicitly reconfirmed **Use new full-gym scope**; older cached
light-gym rules are superseded, not grounds to silently shrink Phase 4.

---

## Current progress — 2026-10-10

**We are in Phase 0, not Phase 1.** Nutrition/capture implementation is merged;
installed native builds, CI and the remaining device gates are not complete.
Later-phase foundations may be reusable, but they do not make those phases DONE.

Status vocabulary: **TODO** (not started), **BUILDING**, **VERIFY** (implemented,
required evidence incomplete), **DONE** (the stated gate is verified), **BLOCKED**
(named dependency prevents completion). Checked implementation items are not a
blanket device or accuracy sign-off. Record the date, device/OS/build, exact flow and
result for each manual checkpoint; leave unreported gates unchecked.

### Current application baseline

- PR **#1** merged on 2026-10-10; application baseline on `main` is **`d41c8a9`**.
  All cumulative photo/voice fixes and draft-list removal are included. No open PRs
  remained when rechecked for this update. Roadmap consolidation is separate docs
  work; future code slices still use branches and reviewable PRs.
- Expo SDK 57 / React Native / TypeScript; local SQLite **schema v4** is the source
  of truth. Durable profile, typed meals, macro corrections, calendar food history
  and local JSON export are implemented. No seeded food logs.
- Text estimates use guest auth, bounded OpenAI calls and normalized local/shared
  caching. Model jobs retry durably; corrections win over late results. Anonymous
  API sessions are **not** permanent accounts, cloud backup or multi-device sync.
- Photo: centre camera opens a live picture view; **Gallery is bottom-right**.
  Both paths resize/sanitize JPEGs, persist privately, estimate asynchronously and
  show approximate macros over the photo. Edit/Remove/Save remain. Only Save adds
  the meal to history/totals. Capture/gallery/vision device sign-off is pending.
- Voice: **Record → Done → editable transcript → Review → macros → Save**.
  Standard native AAC fixes iPhone preparation. Verified native recorder assets
  are copied into project documents before queueing; failed finalization can retry.
  The duplicate Type control is removed from Voice; main-screen typing remains.
- **No visible draft inbox.** Today lists saved meals only. Unfinished records/jobs
  remain durable and exportable, not automatically counted or deleted. Abandoned
  captures are not offered as a resume list; interruption recovery must be verified
  without reintroducing that rejected UI before claiming a full recovery gate.
- Activity is still explicitly demo data; real rings, health adapters, GPS, gym,
  weight/water logging, sleep/HR views, cross-pillar statistics, permanent sign-in,
  sync, billing and launch infrastructure are **not built**.

### Evidence: built versus actually verified

| Area | State | Evidence and remaining boundary |
|---|---|---|
| Profile/typed meals/corrections (legacy 1.1) | VERIFY | Real SQLite tests; founder reports saved meals survive reopening Expo Go on iPhone. Standalone offline cold start, midnight and Android gates remain. |
| Food history/JSON export (legacy 1.2) | VERIFY | Local all-day snapshot, corrections and share integration tested. History/share-sheet/Files cancel-retry and offline device results are not individually signed off. |
| Text nutrition/cache (legacy 3.1/3.2) | VERIFY | Hosted text response, same-ID/same-user/cross-user cache proof and founder save→estimate report. Earlier 808/785 kcal reports used different cache keys; exact equivalent inputs and quality remain unresolved. |
| Photo capture/estimate/review (legacy 3.4) | VERIFY | Private upload/vision, durable explicit Save and late-result protection implemented; native digest regression covered. No current camera/gallery/live-vision accuracy pass is claimed. |
| Voice capture/transcript (legacy 3.3) | VERIFY | Founder reports iPhone recording starts and words appear after Done/Retry. Full transcript edit→macros→Save, denial, 30-second stop, background/reopen/offline and Android checks remain. |
| Native baseline (legacy 2.1) | BLOCKED | Non-destructive projects/dev-client scripts prepared. Full Xcode unavailable in active toolchain; Android toolchain/device access and both installed builds not verified. |
| Repository integration | DONE | PR #1 merged; code on main, preserved Shailu-s author/committer identities, no open PRs at the evidence checkpoint. |
| CI | VERIFY | Mobile CI implemented and actual hosted PR #2 run 38055593788 passes: frozen Yarn, public-config/typecheck, 116-pass TAP floor, both time zones and both bundles. Merge/main-green remains pending; native/SDK/device gates separate. |

**Automated baseline:** 116 tests (114 capture/foundation plus 2 CI contracts),
TypeScript/config guard, both time zones and both bundles pass locally for the CI
slice. YAML/TAP checks pass; hosted PR #2 run 38055593788 also passes. CI on main
still needs merge/verification. At the merged capture-code checkpoint, tests passed in Asia/Kolkata and
America/New_York, public-config guard/Deno checks and both iOS/Android JS/Hermes
bundle exports passed. Native generation/config introspection passed, but none of
those is a signed native compile/install result. Temporary capture DEBUG logs were
removed. Expo compatibility drift remains open, not a claimed compatibility pass.

**Environment recheck:** full Xcode is not active (CommandLineTools only); no Java
runtime is available and Android `adb`/`sdkmanager` are not on PATH. No toolchain
install, permissions change or purchase was attempted for this documentation task.

**Device evidence:** founder iPhone / Expo Go. Exact phone model, iOS version and
client build were not recorded; obtain them on the next QA report. No Android,
standalone native, wearable or full offline cold-start sign-off exists.

### Backend and spending boundaries carried forward

- Approved Supabase project: `Unified-fitness`, ref `sqookqvgdsfgdmckcacc`, region
  `ap-south-1`. Hosted `nutrition-estimate`, isolated `nutrition-photo-preview` and
  `voice-transcribe-preview` were deployed with JWT verification. Preserve private
  buckets, owner/RLS checks, service-only orchestration and cleanup.
- Nutrition pin: `gpt-5-mini-2025-08-07`; voice pin:
  `gpt-4o-mini-transcribe-2025-12-15`, transcript pipeline `indian-meal-v1`.
  Secrets remain backend-only. Current inference is request-driven with durable
  retry/lease recovery, not autonomous background execution.
- **US$1 total testing approval only; no automatic monthly renewal.** Text/photo/
  voice reserve conservative $0.01/$0.02/$0.04 amounts. The last recorded ledger
  inspection was $0.15 reserved under the $1 limit, before subsequent phone QA;
  that is historical evidence, **not current remaining budget or invoice spend**.
  Inspect the ledger read-only before further paid tests; never raise it implicitly.
- Production client inference defaults stay off; ignored development-only overrides
  enable the capped previews. Validation-only checks do not trigger inference.
- Private media uploads are processing inputs and are removed after processing;
  they are **not a permanent cloud photo/audio backup**. JSON export includes
  metadata/transcripts/references, not binary media. Orphan retention/deletion for
  lost anonymous sessions remains public-pilot hardening work (ADRs 006/007).
- Synthetic voice recognition had word errors even after Indian-food prompt hints.
  Visible speech text is a functional checkpoint, not Hindi/English or food-number
  accuracy validation. Photo oil/portion uncertainty stays explicit.

### Next slice and work order

1. **Next coding slice: Phase 0 CI.** Add the existing local verification to PR CI
   using the frozen Yarn 1 lockfile: public-config guard, TypeScript, tests and both
   bundle exports. No live inference, personal fixtures or secret output in CI.
2. **Parallel founder/environment unblock:** full compatible Xcode + signing,
   Android Studio/SDK/JDK + a real Android phone; choose local versus EAS
   distribution in ADR 008. Rechecked active Xcode path is CommandLineTools only;
   `xcodebuild -version` still fails. Android `adb`/`sdkmanager` are not on PATH,
   and `java -version` reports no Java runtime; no SDK-install claim is made from
   PATH checks alone. Do not install/configure paid services or buy memberships/
   devices without explicit approval.
3. **Close Phase 0 nutrition gates on installed builds:** use the checklist below;
   fix capture/edit/save/export/offline failures before declaring the phase done.
   Resolve SDK patch drift once releases satisfy the age policy and pass checks.
4. **Then Phase 1:** decide ADR 009 and build the tabs/global quick-log shell plus
   DashboardRepository's honest per-tile states. Reuse the nutrition internals;
   do not rewrite estimation or start gym/GPS as the next slice.

Phase 0 remains open until **both installed dev-clients work and CI is green on
main**, plus the required nutrition close-out evidence is recorded. Founder decides
any exception explicitly; merging code alone did not satisfy that exit gate.

## 0. The product in one paragraph

One app replacing four: **Apple-Fitness-style rings** (steps, active calories,
exercise minutes), a **calorie/macro food log** driven by LLM estimation (text,
photo, voice), **Hevy-style gym logging** with history and strength statistics, and a
**Strava-style walk/run recorder** with live GPS — plus body weight, water, sleep and
resting HR/HRV read from the phone's health layer. **No social features.** iOS and
Android simultaneously. Wearables (Apple Watch, Fitbit, Samsung, Garmin, Mi Band…)
are integrated **indirectly through HealthKit / Health Connect**, never vendor SDKs.
Offline-first; network and model calls never block a log. The unification itself is
the product; the UX rule is **any screen in ≤ 2 taps, any log in ≤ 3 taps**.

## 1. Locked decisions (2026-10-10)

| Dimension | Decision |
|---|---|
| Persona | Indian IT employee; walks, gym 2-4x/week, wants to stay healthy. Not an athlete. |
| Gym | **Full Hevy-style**: exercise library, routines/templates, rest timer, per-set previous-performance hints, PRs, volume/1RM trends, body-part breakdown. |
| Cardio | **Outdoor walk + run** with live GPS (pace, splits, map, elevation). Treadmill/indoor = manual duration + distance. No cycling/swim in V1. |
| Rings | Steps, active calories, exercise minutes. Stand hours are **not** a ring (not available cross-platform). |
| Extra metrics | Body weight + trend + goal; water; sleep (read-only from OS); resting HR / HRV (read-only, trend only). |
| Wearables | **OS health layer only** (HealthKit on iOS, Health Connect on Android). No Fitbit/Garmin cloud APIs, no watch apps. |
| Food | LLM estimates everything (text/photo/voice), mandatory local + shared caching, hand-correctable, explicit uncertainty. Already built; see §3 Phase 0. |
| Accounts | **Optional**. Full guest use. Sign-in (Apple / Google / email OTP) unlocks cloud backup/restore and billing. |
| Monetization | Freemium. **Free:** all manual logging + N AI estimates/day. **Paid:** unlimited AI, weekly insights, advanced charts, cloud backup/sync. Price TBD before Phase 7. |
| Social | None. No feed, no followers, no leaderboards, no sharing cards in V1. |
| Platforms | iOS + Android simultaneously. Expo / React Native / TypeScript, dev-client builds (not Expo Go) from Phase 1 onward. |
| Target | **Public store launch in ~6 months** (target: 2027-04). See §2 honesty note. |
| Capacity | 10-15 h/week founder time + agents. |

## 2. Honest assessment before you start (read this)

**The 6-month target is aggressive for this scope.** 26 weeks × ~12 h ≈ 310 founder
hours. Agents remove most typing time, but the following are wall-clock bound and
cannot be parallelised by agents:

- Physical device QA on iPhone **and** a real Xiaomi/Realme/OnePlus (background GPS,
  Health Connect permissions, OEM battery killers). Budget ≥ 1 evening/week for this.
- Apple Developer Program ($99/yr) and Google Play Console ($25) sign-up, identity
  verification, and — critically — **Google Play's new-personal-account rule: 12
  testers opted-in for 14 continuous days of closed testing before you may apply for
  production access.** This alone forces a pilot by **week 18 at the latest**.
- App Store review of background-location and HealthKit usage strings; Play Store
  Health Connect permission declaration form review (can take 1-2 weeks each).
- LLM accuracy evaluation on Indian meals (human judgement, not automatable).

**Mitigation built into this plan:** every phase has a **Must** tier and a **Cut-line**
tier. If a phase runs over, ship Must, defer Cut-line to post-launch. Under no
circumstances defer: health layer, GPS reliability, offline durability, accounts,
billing restore, data export, account deletion — these are store-blocking.

**Biggest technical risks, ranked**
1. Android background GPS killed by OEMs (one-star-review risk #1). Phase 3 spike
   before any GPS UI.
2. Health Connect availability/permission fragmentation (Android 14+ built-in; 9-13
   via Play Store app; varies by OEM). Phase 2 handles "unavailable" as a first-class
   state.
3. Hevy-style gym scope creep. The exercise library + routines + history is a
   product in itself. Phase 4 has the strictest cut-line.
4. Sync conflicts once accounts exist. Single-user data keeps this tractable
   (last-writer-wins per row with `updated_at`); do not add sharing.
5. LLM cost on free tier. Daily quota + cache make it bounded; never ship AI
   without quota enforcement server-side.

## 3. Phase map

Weeks are planning estimates, not commitments. Phases overlap where marked.

| Phase | Name | Current state | Weeks | Depends on | Store-blocking? |
|---|---|---|---|---|---|
| 0 | Close out nutrition + native build baseline | VERIFY; native baseline BLOCKED, CI PR passes/main pending | 1-3 | — | Yes (native builds) |
| 1 | Navigation shell + unified Today dashboard (real data contracts) | TODO; existing theme/day/nutrition code reusable | 3-5 | 0 | Yes |
| 2 | Health layer: rings, steps, sleep, RHR/HRV, weight, water | TODO | 5-9 | 1 | Yes |
| 3 | Live GPS walk/run | TODO | 9-13 | 0 (native), 2 (health write) | Yes |
| 4 | Hevy-style gym | TODO | 11-17 | 1 | Yes (core pillar) |
| 5 | Statistics, trends and history across pillars | TODO; existing food-only history is not this phase | 15-18 | 2,3,4 | Partial |
| 6 | Accounts, backup/restore, sync | TODO; anonymous API auth is only a foundation | 17-20 | 1 | Yes |
| 7 | Billing, AI quota, insights (premium) | TODO; test budget guards are not a paid-tier system | 20-23 | 6 | Yes |
| 8 | Hardening, compliance, pilot, store launch | TODO; JSON export is a reusable foundation | 18-26 | all | Yes |

Pilot (closed testing, 12+ testers) starts **week 18** on whatever is Must-complete,
and runs continuously to launch to satisfy Play's 14-day rule and to get retention data.

---

## Phase 0 — Close out nutrition + native build baseline (weeks 1-3)

**Goal:** stop building new features on Expo Go; get installable dev-client builds on
both platforms; finish the open nutrition gates; merge open branches to main.

### 0.1 Must

- [ ] Install full Xcode (SDK-57-compatible version), accept licence, run
      `yarn native:generate` then `yarn ios:device` with Personal Team signing.
      Record exact Xcode version + iOS version in this plan's evidence log.
- [ ] Install Android Studio / SDK / JDK 17; `yarn android:device` on a physical
      Android phone (preferably Xiaomi/Realme/OnePlus — buy a used one if needed,
      ~₹8-12k; this is the single best QA investment in the project).
- [x] Merge cumulative photo/voice capture work via PR: **PR #1 merged to main at
      `d41c8a9` on 2026-10-10**, under explicit founder approval. Local and remote
      main were synced; feature branch refs were preserved.
- [ ] Complete nutrition phone QA in §0.3 below. Merge completion is not a blanket
      manual gate pass; fix reported blockers first.
- [ ] Resolve Expo compatibility drift once patches are >7 days old. Re-run on
      2026-10-10: `yarn expo install --check` still recommends expo 57.0.27,
      expo-image-manipulator 57.0.21 and expo-sqlite 57.0.4. Existing tested pins
      retained; this failed check is an open gate, not a completed update.
- [ ] Decide and record: EAS Build vs local builds for pilot distribution (ADR 008).
      Recommendation: EAS Build free tier for TestFlight/internal testing; local
      builds for daily dev. Requires Apple Developer Program → **enrol now**, it takes
      days.
- [ ] Set up GitHub Actions CI: `yarn check:config`, `yarn typecheck`, `yarn test`,
      both `expo export` bundles on every PR. Fail PRs that drop below current test
      count without justification.

### 0.1a Current blockers and founder actions (2026-10-10)

- **CI implementation:** `.github/workflows/mobile-ci.yml`, Node 25.6.1/Yarn 1.22.22
  matching the verified local harness, mature full-SHA-pinned checkout v7.0.1 and
  setup-node v7.0.0 (not the two-day-old v7.1.0). Read-only permissions, no persisted
  checkout credentials, inference/smoke flags false, no secrets/deployments. A TAP
  guard requires all tests pass and at least the reviewed 116-test baseline. Founder
  approves publishing the branch/opening a PR. Actual hosted run **38055593788**
  on **PR #2** passes on 2026-10-10, including both exports. PR remains open;
  merge was not approved in the publishing checkpoint, so main-green stays pending.
- **SDK drift is blocked by release age, not ignored:** all three recommended patches
  were published October 6 around 12:11 UTC. Earliest seven-day eligibility for all
  is **October 13 after 12:12 UTC**; do not bypass the age policy/security controls.
  Keep this item unchecked until actual eligible update and checks complete.
- **iOS:** macOS 15.7.4 arm64, 139 GiB free at inspection, no Xcode.app in Applications.
  Apple lists Xcode 26.3 as compatible with macOS 15.6+; current Xcode 27 needs
  macOS 26.6+. Recommend the compatible 26.3 download, not an automatic OS upgrade.
  Expo SDK 57 has extra scene-lifecycle requirements if choosing Xcode 27 later.
  See https://developer.apple.com/xcode/system-requirements/ and
  https://expo.dev/changelog/sdk-57 . This is compatibility research, not a compile.
- **Founder iPhone steps:** download Xcode 26.3 from
  https://developer.apple.com/download/all/?q=Xcode using own Apple login; expand/move
  into Applications; open/accept licence/install iOS components; Settings→Locations
  select its Command Line Tools; Settings→Accounts add Apple Account/Personal Team;
  connect/unlock/trust iPhone and enable Developer Mode if prompted. Record iOS
  version. Licence/login/admin/signing actions remain with founder; do not ask for
  passwords or buy a membership automatically. Confirm bundle-ID/team ownership
  before any identifier change.
- **Android:** founder currently has iPhone only; physical Android remains unavailable.
  Android Studio/default SDK/JDK paths are absent, adb/sdkmanager unavailable, no Java
  runtime. Homebrew openjdk@17 attempt proposed 19 shared-library upgrades and was
  stopped before installation; checked versions unchanged and no JDK/json-c installed.
  Download caches may exist. No tap-trust/security settings were changed. Prefer a
  bounded standalone JDK/Android Studio setup under founder review, not broad host
  upgrades. Owner reviews SDK licences; use a real Android device for final QA.
- **Installed-device nutrition QA is still blocked.** A generated project/bundle is
  not an installed test build. Keep Expo Go/data intact: own native apps have a separate
  sandbox; export existing records for backup and do not promise automatic migration.
  Once native builds work, run §0.3 and record exact device/OS/build evidence. Use a
  bundled-JS installed build for standalone offline cold-start proof, not Metro alone.

### 0.2 Cut-line

- [ ] Reference-meal accuracy evaluation of 20 Indian meals (text + photo) with
      known portions; record error distribution in `docs/research/nutrition-eval.md`.
      Needed before marketing any accuracy claim; not needed to ship.

### 0.3 Nutrition close-out — migrated live verification gates

These are Must reliability/device gates, distinct from the 20-meal Cut-line study.
Legacy slice IDs are retained in the progress table for older commit/test references;
they do not retain the superseded light-gym scope or draft-inbox instructions.

- [x] Durable SQLite v4 profile/meals/jobs, full macros/unknown values, revisions,
      correction protection, food history and JSON export implemented/tested.
- [x] Founder reports iPhone Expo Go launch and saved-meal reopen persistence.
- [x] Text guest-auth/real estimate and same/cross-user cache proof recorded.
- [x] Photo review-before-save, privacy sanitization/private transport, non-food
      failure, bounded retries and no-count-before-Save covered automatically.
- [x] Voice native-start/owned-file issues fixed; founder reports Done/Retry shows
      spoken words. This is only that narrow iPhone checkpoint.
- [ ] Record actual device model, OS and client/build versions for both platforms.
- [ ] Camera icon opens live view; Gallery bottom-right works; denied permission,
      picker/capture cancellation and processing-consent cancellation are safe.
- [ ] Photo → upload/approximate macro overlay → Edit/Remove → Save once. Totals
      change only after Save; overlay remains readable on varied images/large text.
- [ ] Voice → Record → Done → transcript correction → Review → macro correction →
      Save once. No duplicate Type control. Permission denial, 30-second automatic
      finish, close/background and Retry on the original completed clip verified.
- [ ] Installed-build offline capture/save/edit, terminate/reopen, reconnect and
      late-result protection tested for text/photo/voice on both OSes. Preserve old
      logs; never clear storage. Decide/verify unfinished-capture recovery without
      a visible draft inbox; data in SQLite alone is not proof of usable recovery.
- [ ] Midnight/date isolation, food history navigation/editing and native dismissal
      verified; older corrections retain their original day/identity.
- [ ] Export cancel/retry/Save to Files and offline browsing/sharing verified on both
      platforms. JSON has all local days/unknown values; no binary photos/audio.
- [ ] Private media access/cleanup and non-food/model/network failure paths checked
      on device; invalid input never becomes fabricated zero nutrition.
- [ ] Exact-input retest of the paneer/roti inconsistency report documented; previous
      inputs had distinct cache keys. Do not claim an equivalent-input bug resolved.
- [ ] English/Hindi/mixed speech and food-number errors checked; allow correction.
      No accuracy marketing without the separate reference evaluation.

**Founder checklist for the next installed-build test (≤8 steps):**
1. Record device/OS/build; open the app without resetting existing data.
2. Type a meal → estimate → correct → Save; confirm one record and correct totals.
3. Camera → capture, then Gallery → existing food image; check macros/Edit/Save.
4. Voice → Record → Done → check words → Review → edit macros → Save once.
5. Deny/cancel permissions/pickers/consent; retry a failure; no phantom saved meal.
6. Airplane mode → log/edit → terminate → reopen offline → restore internet; check
   durability, recoverability and that late estimates do not replace corrections.
7. Browse a previous day; edit; export JSON via local Files, including cancel/retry.
8. Repeat on the physical Android phone; report each result and screenshots/errors,
   not a single aggregate “works” that implies all optional gates passed.

### Exit criteria
Dev-client runs on iPhone and Android phone from `yarn start:dev`; CI green on main;
required §0.3 nutrition reliability/device gates recorded. No stale open feature PRs;
retained already-merged branch refs are not unfinished features and need not be
force-deleted to satisfy the gate.

---

## Phase 1 — Navigation shell + unified Today dashboard (weeks 3-5)

**Goal:** the information architecture that every later pillar plugs into. Founder's
rule: *user reaches any screen with minimal effort*. This phase defines the contract
each pillar must satisfy to appear on Today.

### 1.1 Information architecture (decide in ADR 009, then do not reopen)

Recommended structure — **5 bottom tabs + 1 global quick-log action**:

```
┌───────────────────────────────────────────────┐
│ Today      Food      [+]      Move      Gym   │   ← bottom tabs; [+] is a raised
└───────────────────────────────────────────────┘      quick-log button
                                                     "You" (weight/water/sleep/HR/
                                                      settings) lives top-right on
                                                      Today as a profile avatar.
```

- **Today**: rings + calories in/out + today's meals summary + today's workouts
  (gym + walk/run) + weight/water/sleep tiles. Every tile taps straight into its
  pillar. This is the product.
- **Food**: today's meals, macro bar, calendar history. Existing screens move here.
- **[+] quick log** (always visible): sheet with Photo / Type / Voice / Water /
  Weight / Start walk / Start run / Start workout. One tap to any log type.
- **Move**: rings detail, steps chart, walk/run list, Start walk/run.
- **Gym**: routines, start empty workout, history, exercise library, PRs.
- **You** (modal/stack from Today avatar): profile, goals, weight trend, water,
  sleep, RHR/HRV, integrations (health permissions), export, account, subscription.

Tap-count targets (hard requirements, tested manually each phase):

**ADR 009 decision gate:** the proposed photo flow below is four taps including
Save, while the locked product rule says any log ≤3. Resolve the flow/counting
contract with the founder before claiming compliance; no tap-count pass is recorded.
- Log a meal by photo: 3 taps (+, Photo, shutter) → Save = 4.
- Log water: 2 taps (+, Water preset).
- Start a run: 2 taps (+, Run) or (Move, Start run).
- Start last routine: 2 taps (Gym, routine card) → Start.
- Reach any pillar's history: ≤ 2 taps.

### 1.2 Must

- [ ] Add `@react-navigation/native`, `@react-navigation/bottom-tabs`,
      `@react-navigation/native-stack` (pin versions ≥7 days old; record in ADR 009).
      Replace the current swipe-based `MainScreen` with tabs; keep the existing
      screens' internals.
- [ ] Today dashboard reads from a single `DashboardRepository` that aggregates
      per-pillar repositories with **explicit states per tile**:
      `loading | ready | no-permission | unavailable | demo`. No fake zeros.
      Demo-labelled activity data is removed once Phase 2 lands; until then the tile
      shows "Connect Health" CTA, not demo numbers.
- [ ] Quick-log sheet component with the 8 actions above; actions not yet built show
      a disabled state with "Coming soon" copy.
- [ ] Shared design tokens: one `theme.ts` (exists) extended with spacing/typography
      scales; ring component reused. Larger-system-text and dark mode verified.
- [ ] Local notifications foundation (`expo-notifications`): permission flow, daily
      "log your meals" reminder off by default, settings toggle. (Retention lever;
      cheap now, painful later.)
- [ ] Day-boundary logic unified: one `localDay(ts)` util used by every pillar; tested
      in Asia/Kolkata and America/New_York as the existing tests do.

### 1.3 Cut-line
- [ ] Haptics on log success. Onboarding redesign (keep current until Phase 8).

### Exit criteria
Tabs work on both dev-client builds; existing nutrition flows unchanged; Today shows
nutrition for real and honest placeholders for everything else.

---

## Phase 2 — Health layer: rings, steps, sleep, RHR/HRV, weight, water (weeks 5-9)

**Goal:** real daily activity data on both platforms behind one interface; wearables
"just work" because they already write into HealthKit / Health Connect.

### 2.1 Architecture (ADR 010)

```
mobile/src/health/
  HealthProvider.ts         ← interface (read/write/permissions/availability)
  healthkit/                ← iOS impl
  healthconnect/            ← Android impl
  index.ts                  ← platform select; nothing outside imports impls
  normalise.ts              ← unit + dedup rules, shared
```

Interface (minimum):
```ts
type Availability = 'available' | 'needs-install' | 'unsupported';
interface HealthProvider {
  availability(): Promise<Availability>;
  requestPermissions(scopes: Scope[]): Promise<PermissionResult>;
  readDailySteps(day): Promise<Reading<number>>;
  readActiveEnergy(day): Promise<Reading<kcal>>;
  readExerciseMinutes(day): Promise<Reading<minutes>>;
  readSleepSessions(range): Promise<SleepSession[]>;
  readRestingHeartRate(range): Promise<Sample[]>;
  readHRV(range): Promise<Sample[]>;
  readWeight(range): Promise<Sample[]>;
  writeWeight(sample): Promise<void>;
  writeWorkout(workout): Promise<void>;          // used by Phases 3-4
  writeNutrition?(day, macros): Promise<void>;   // optional, cut-line
}
```
`Reading<T>` carries `{ value, sources[], status: 'ok'|'partial'|'none'|'denied' }`.

Library candidates (verify maintenance + SDK-57 config plugin before pinning;
record in ADR 010):
- iOS: `@kingstinct/react-native-healthkit` (Expo config plugin, actively maintained).
- Android: `react-native-health-connect` (Expo config plugin). Requires
  `minSdkVersion 26`, Health Connect permission rationale activity, and the Play
  Console **Health apps declaration**. Android 14+ has Health Connect built in;
  Android 9-13 requires the Play Store Health Connect app → `needs-install` state
  with deep link.

Metric definitions (cross-platform):
- **Steps**: sum of primary-source steps; dedupe phone vs watch (HealthKit does this
  if you query with `.cumulativeSum` on the quantity type; Health Connect aggregate
  API dedupes by default). Never sum raw records from multiple sources.
- **Active calories**: HealthKit `activeEnergyBurned` / HC `ActiveCaloriesBurned`.
  If no wearable and no phone estimate → status `none` and ring shows "—", with CTA.
- **Exercise minutes**: HealthKit `appleExerciseTime` (watch only) / HC
  `ExerciseSession` durations + fallback: our own recorded walks/runs/gym sessions.
  Document that iPhone-only users get exercise minutes only from in-app workouts.
- **Ring goals**: steps default 8,000; active kcal from profile (300-500); exercise
  30 min. Editable in You.

### 2.2 Must

- [ ] Health permission onboarding screen in You → Integrations and first-run of
      Move tab. Explain what's read. Deny → app still fully works; tiles show
      "Connect" CTA.
- [ ] Rings on Today and Move with real data, refreshed on foreground + pull.
      Background refresh: iOS `HKObserverQuery` cut-line; Android none (HC has no
      push). Foreground refresh is acceptable V1.
- [ ] Steps chart: last 7 / 30 days (hourly today optional).
- [ ] **Body weight**: log from quick-log (number pad, kg, 2 taps + type), stored in
      SQLite, written to health layer if permitted; read wearable-scale weights too;
      trend line (7-day EMA) + goal weight in You.
- [ ] **Water**: quick-log presets (200 / 300 / 500 ml, custom); daily goal; Today
      tile. Local only (health write cut-line).
- [ ] **Sleep**: last night duration + 7-day bars in You; read-only.
- [ ] **RHR / HRV**: 30-day trend sparklines in You; read-only; hidden entirely when
      no data (no empty chart).
- [ ] Calories balance on Today: `eaten − (BMR + active)` with explicit "estimate"
      label; BMR via Mifflin-St Jeor from profile.
- [ ] Deduplication registry: every workout we record (Phase 3/4) gets an
      `external_id` written to the health store; on read, workouts carrying our id
      are skipped.
- [ ] Tests: provider fakes for every status; normalisation unit tests; dashboard
      aggregation tests. Device gates per platform recorded in this plan's evidence log.

### 2.3 Cut-line
- [ ] Write nutrition totals to health store. iOS background observers. Hourly steps.

### Exit criteria
Founder's iPhone (with or without Apple Watch) and the Android phone show real rings;
permission denial and "Health Connect not installed" paths verified on device.

---

## Phase 3 — Live GPS walk/run (weeks 9-13)

**Goal:** Strava-grade recording for walks and runs, reliable with the screen locked,
on OEM Android. Start with a spike; no UI until the spike passes.

### 3.1 Week-9 spike (ADR 011) — do this first, gate the phase on it

- [ ] `expo-location` background updates + `expo-task-manager`; iOS
      `UIBackgroundModes: location`, `NSLocationAlwaysAndWhenInUseUsageDescription`;
      Android foreground service with `foregroundServiceType="location"` and
      persistent notification (required Android 14+).
- [ ] 45-minute locked-screen walk on iPhone and on the Xiaomi/Realme device with
      battery saver **on**. Record: point count, gaps >10 s, distance vs known route,
      battery drain %. Pass = no gap >30 s on iPhone; document OEM results and
      required user steps (autostart/battery whitelist) for an in-app
      "Keep tracking reliable on this phone" guide.
- [ ] Decide map library: `react-native-maps` (Apple Maps iOS free; Google Maps SDK
      for Android is no-charge for native mobile but needs API key + config plugin).
      Alternative if key management is a burden: `@maplibre/maplibre-react-native`
      with OSM-based tiles. Record choice.

### 3.2 Data model (SQLite, additive migration)

```
cardio_sessions(id, type walk|run|manual, status recording|paused|finished|discarded,
  started_at, ended_at, moving_ms, elapsed_ms, distance_m, elevation_gain_m,
  avg_pace_s_per_km, kcal_estimate, source local|health|manual, health_external_id,
  local_day, created_at, updated_at, deleted_at)
cardio_points(session_id, seq, ts, lat, lng, alt, accuracy, speed)   -- append-only
cardio_splits(session_id, km_index, duration_ms, pace_s_per_km)      -- derived, cached
```
Points are **written to SQLite as they arrive** (batched ≤ 2 s); a kill mid-run must
leave a resumable `recording` session on next launch ("Resume or finish?").

### 3.3 Must

- [ ] Start/pause/resume/finish from Move or quick-log; big live numbers: time,
      distance, current pace, avg pace; map with live polyline; lock-screen/
      notification controls where the platform allows.
- [ ] Auto-pause (speed < 0.5 m/s for 10 s) toggleable; GPS accuracy filter
      (drop points with accuracy > 30 m; Kalman-lite smoothing optional).
- [ ] Summary screen: map, km splits, elevation, kcal estimate (MET-based from
      profile weight), notes; edit type walk↔run; delete.
- [ ] Manual entry: treadmill / indoor — duration + distance.
- [ ] Write finished session to health store with `external_id`; import external
      walks/runs (from watch/Strava-via-health) into the Move list, read-only.
- [ ] Export: GPX per session (data ownership principle) + included in JSON export.
- [ ] In-app OEM reliability guide shown once on affected manufacturers
      (`Device.manufacturer` ∈ Xiaomi/Redmi/POCO/Realme/Oppo/Vivo/OnePlus/Samsung).
- [ ] Tests: distance/pace/split math, resume-after-kill repository tests, point
      batching, accuracy filtering. Device gates: locked-screen 45 min both OSes,
      low-battery mode, denied "Always" permission (iOS "While Using" + screen on
      still works and says so).

### 3.4 Cut-line
- [ ] Audio pace cues, heart-rate overlay from watch, route re-run, weekly distance goal.

### Exit criteria
Founder completes 3 real outdoor walks/runs on each platform with correct distance
(±3% vs a reference app) and no lost sessions.

---

## Phase 4 — Hevy-style gym (weeks 11-17, overlaps Phase 3)

**Goal:** full strength logging with the speed Hevy users expect, zero network.
Strictest cut-line in the plan.

### 4.1 Data model (ADR 012)

```
exercises(id, name, body_part, equipment, is_custom, media_ref?, created_at, deleted_at)
routines(id, name, notes, position, created_at, updated_at, deleted_at)
routine_exercises(routine_id, exercise_id, position, default_sets, rest_seconds, notes)
workouts(id, routine_id?, name, started_at, ended_at, status active|finished|discarded,
  notes, kcal_estimate?, health_external_id, local_day, created_at, updated_at, deleted_at)
workout_exercises(id, workout_id, exercise_id, position, notes, superset_group?)
workout_sets(id, workout_exercise_id, position, set_type normal|warmup|drop|failure,
  weight_kg, reps, rpe?, duration_s?, distance_m?, completed_at, is_pr)
personal_records(exercise_id, kind heaviest|best_1rm|best_volume|most_reps, value,
  set_id, achieved_at)
```
Exercise library: ship a **seed JSON (~300 exercises, CC/own-authored names,
body-part + equipment tags)**, not images/videos in V1 (storage, licensing). Custom
exercises are first-class. Search is prefix + fuzzy on name.

### 4.2 Must

- [ ] Gym tab: routines grid, "Start empty workout", recent workouts, exercise
      library, PRs.
- [ ] Active workout screen (the core): add exercise → sets table with
      **previous-performance ghost values** ("60 × 8" greyed in each field), tap to
      copy, check to complete set, auto-start **rest timer** with notification when
      backgrounded, running duration, finish → summary. Must survive kill/reopen
      (status `active` resumes).
- [ ] Routines: create from scratch or from a finished workout ("Save as routine");
      reorder exercises; start routine pre-fills sets.
- [ ] Per-exercise history: list of past sessions, heaviest weight / best 1RM
      (Epley) / volume charts (30 / 90 days / all).
- [ ] PR detection on set completion with a subtle badge (no confetti).
- [ ] Workout history list with calendar; weekly summary: workouts, sets, volume,
      body-part distribution (simple bar list, **not** a muscle heatmap).
- [ ] Write finished workout to health store (`traditionalStrengthTraining` /
      HC `ExerciseSession` type strength) with `external_id`; kcal via MET ~3.5-6.
- [ ] Units: kg default, lb toggle; plate-agnostic.
- [ ] Export: workouts in JSON export + CSV (Hevy/Strong-compatible columns for
      switchers).
- [ ] **Import from Hevy/Strong CSV** (switcher onboarding; cheap, high-value).
- [ ] Tests: repository CRUD, resume-after-kill, PR computation, 1RM, volume
      aggregation, CSV import/export round-trip.

### 4.3 Cut-line
- [ ] Supersets UI, RPE, exercise images, plate calculator, warm-up set generator,
      body-measurement photos, routine folders. Keep schema columns; hide UI.

### Exit criteria
Founder logs 2 weeks of real gym sessions on the app only (not Hevy) and does not
miss anything blocking; rest timer and resume verified on both OSes.

---

## Phase 5 — Statistics, trends and history across pillars (weeks 15-18)

**Goal:** the "previous statistics" the founder asked for, kept minimal: one Trends
screen reachable from Today, with per-pillar deep dives already built in Phases 2-4.

### 5.1 Must
- [ ] Trends (from Today header): week/month toggles; cards: calories in vs out,
      protein avg, steps avg, active kcal, workouts count + volume, walk/run
      distance, weight trend, sleep avg. Each card taps into its pillar's detail.
- [ ] Unified calendar: any day → that day's Today snapshot (meals, workouts, rings).
- [ ] Charting: decide one library in ADR 013. Default recommendation: hand-rolled
      with `react-native-svg` (already a dependency) for bars/lines/sparklines; adopt
      `victory-native` only if interaction (scrub/tooltip) proves necessary.
- [ ] Derived-metric cache table (`daily_summaries(local_day, …)`) recomputed
      incrementally on write, so Trends never scans raw tables.
### 5.2 Cut-line
- [ ] Streaks, weekly PDF/image report, correlations ("you sleep better on gym days").

---

## Phase 6 — Accounts, backup/restore, sync (weeks 17-20)

**Goal:** optional sign-in that turns the existing Supabase guest session into a
durable account; full backup/restore; multi-device sync for the single user.

### 6.1 Architecture (ADR 014)
- Supabase Auth: Sign in with Apple (required on iOS when offering Google), Google,
  email OTP. **Link the existing anonymous user** to the new identity so cached
  estimates and guest history carry over (Supabase supports anonymous → permanent
  linking). Secure token storage already exists (`secureSessionStorage.ts`).
- Sync = **durable outbox + pull-since-cursor**, per table, last-writer-wins on
  `updated_at`, soft deletes via `deleted_at`. Single-user data; no CRDTs. Every
  SQLite table that syncs gets `updated_at`, `deleted_at`, `synced_at`.
- Server: one Postgres schema per pillar with RLS `owner_id = auth.uid()`; a
  `sync_push` RPC (idempotent on row id + updated_at) and `sync_pull(since)`.
- Current private Storage uploads are temporary estimation inputs and are cleaned
  after processing; local photos are not already backed up. Design retained private
  media backup/restore in ADR 014 before promising lazy photo restore. Keep sync
  payloads reference-based, with a separate bounded/consented media upload policy.
- Restore on new phone: sign in → full pull → app usable; photos lazy.

### 6.2 Must
- [ ] Sign-in/out UI in You; signed-out = everything works locally.
- [ ] Outbox + pull implemented for: profile, meals (+revisions), weight, water,
      cardio sessions (points as compressed blob), workouts/sets/routines/custom
      exercises, settings.
- [ ] Conflict policy tested: edit same meal offline on two devices.
- [ ] **Account deletion** (store requirement): server RPC wipes rows + storage;
      local wipe optional with confirmation.
- [ ] Sign-out keeps or wipes local data — explicit choice dialog.
- [ ] Tests: outbox ordering, idempotent push, pull merge, deletion propagation,
      RLS isolation (extend `supabase/tests`).

### 6.3 Cut-line
- [ ] Multi-device realtime; passkeys.

---

## Phase 7 — Billing, AI quota, insights (weeks 20-23)

**Goal:** the paid tier, with entitlement enforced server-side for AI and
client-side for UI.

### 7.1 Decisions needed from founder before starting
- Price (recommendation to evaluate: ₹149-199/month, ₹999-1,299/year; 7-day trial).
- Free AI quota (recommendation: 5 estimates/day, cache hits free and unmetered).
- Insights content for V1: weekly text summary generated server-side from
  `daily_summaries` with the pinned model, 1 call/week/user, cached.

### 7.2 Must (ADR 015)
- [ ] RevenueCat (`react-native-purchases`) for both stores; entitlements webhook →
      Supabase `entitlements` table; Edge functions check entitlement + quota before
      inference (extend existing budget ledger per user).
- [ ] Paywall screen (minimal, no dark patterns), restore purchases, trial, grace
      period / billing-retry states, family/promo codes via stores.
- [ ] Quota UX: counter in quick-log, graceful "today's free estimates used — type
      macros manually or upgrade"; never block saving the meal.
- [ ] Weekly insight card on Today for subscribers (text, 3-5 bullets); opt-out.
- [ ] Monthly server spend cap stays mandatory; raise only with founder approval.
- [ ] Tests: entitlement gating in edge functions; quota reset at local midnight vs
      UTC decision documented; webhook idempotency.

### 7.3 Cut-line
- [ ] Advanced charts behind paywall (ship free until measured), lifetime plan.

---

## Phase 8 — Hardening, compliance, pilot, launch (weeks 18-26, overlapping)

### 8.1 Pilot (start week 18)
- [ ] TestFlight + Play closed testing with **≥ 12 testers** (friends/colleagues
      matching persona; mix of iPhone and Xiaomi/Realme/Samsung). Keep enrolled 14+
      days continuously.
- [ ] Instrumentation: Sentry (crashes) + PostHog or equivalent (events only, **no
      health or food payloads**; event names + counts). Consent screen.
- [ ] Weekly pilot review: activation (first log), D1/D7/D14 return, logs per day,
      GPS session failures, HC/HK permission grant rate, top 3 complaints.
- [ ] Interview 5 pilots at week 2 (15 min each). Record in `docs/research/`.

### 8.2 Compliance / store readiness
- [ ] Privacy policy + terms (hosted page); privacy nutrition labels (iOS) and Data
      safety form (Play); Health Connect permission declaration; HealthKit usage
      strings; background location justification + demo video for App Review.
- [ ] Account deletion in-app (both stores require); data export (already).
- [ ] iOS Privacy Manifest for required-reason APIs; Android target SDK current.
- [ ] Onboarding rewrite: ≤ 4 screens, skippable, asks health permissions in
      context not up-front.
- [ ] Performance: cold start < 2 s on mid-range Android; Today renders from
      SQLite before any network; list virtualisation for history.
- [ ] Accessibility pass: dynamic type, contrast, VoiceOver/TalkBack labels on
      quick-log and active-workout controls.
- [ ] Localisation scaffold (English only shipped; strings externalised, Hindi
      later).
- [ ] Store listings, screenshots (both platforms), app name/trademark check
      (`docs/research/naming.md`).
- [ ] EAS Update (OTA) configured for JS-only hotfixes; runtime version policy.
- [ ] Staged rollout: Play 10% → 50% → 100%; iOS phased release.

### 8.3 Launch gate checklist (all must be true)
- Both platforms: offline cold start, kill mid-log in every pillar, reopen → data intact.
- GPS: 3 successful 30-min locked-screen sessions on iPhone + the OEM device.
- Health: grant / deny / not-installed paths verified on device.
- Billing: purchase, restore, cancel, expiry verified in sandbox on both stores.
- Account: create, sync to second device, delete — verified.
- Export: JSON + GPX + CSV open in a third-party tool.
- No store-blocking issues from pilot in the last 7 days.

---

## 4. Cross-cutting engineering rules (apply to every phase)

1. **SQLite is the source of truth.** Every write is durable before UI updates.
   Additive migrations only; current schema v4; each phase bumps version and adds an
   `up` test over a real v(n-1) fixture database.
2. **Repositories, not SQL in screens.** One repository per pillar under
   `mobile/src/lib/` (or `src/<pillar>/`), with Node `node:sqlite` tests as today.
3. **Platform divergence is quarantined**: `src/health/`, `src/location/`,
   `src/billing/` each expose one interface; screens never import platform modules.
4. **Honest states.** `loading | ready | partial | none | denied | unavailable |
   demo` — never render a fabricated zero.
5. **Tap-count budgets** from §Phase 1.1 are acceptance criteria.
6. **Dependencies**: pin exact versions, ≥ 7 days old, Expo SDK-57 compatible
   (`yarn expo install --check`), recorded in the phase ADR. No floating ranges.
7. **Secrets**: server-only. Mobile config holds only the public Supabase URL/key.
8. **Spend**: every model call reserves against the ledger; monthly caps require
   founder approval. Current approval: US$1 total testing.
9. **Verification before DONE**: automated (`yarn check:config && yarn typecheck &&
   yarn test && expo export both`) **and** founder device report. Agents never mark a
   device gate passed.
10. **Commits**: meaningful slice commits with author/committer
    `Shailu-s <srajawat024@gmail.com>` set per command; branches + PRs to main; never
    push without explicit instruction.
11. **ADRs** for every architecture choice: `docs/decisions/NNN-*.md` with context,
    decision, tradeoffs. Numbers reserved above: 008-015.

## 5. Device test matrix

| Device | OS | Why |
|---|---|---|
| Founder iPhone | actual iOS/model/build not yet recorded | primary; Expo Go launch/reopen/voice transcript checkpoints only; Apple Watch availability unverified |
| Xiaomi/Redmi/POCO or Realme (physical) | Android 13-15, MIUI/HyperOS | OEM battery killers, HC built-in vs Play-store |
| Samsung (pilot tester) | One UI | Samsung Health → HC bridge |
| Android 11-12 phone (pilot tester) | needs HC from Play | `needs-install` path |

## 6. Agent execution protocol

This plan is written to be executed by AI agents under founder review. For every
slice an agent picks up:

1. Read `CLAUDE.md`, this plan's current progress/phase section and the relevant
   ADR(s). Do not re-open locked decisions; if a
   decision is missing, write the ADR draft and **ask the founder** before building.
2. Create a branch `feat/<phase>-<slice>` from main.
3. Write failing tests first where the repository/test pattern exists.
4. Implement the Must items only; put Cut-line items behind a flag or skip.
5. Run the automated checks; add tests to keep count non-decreasing.
6. Update `docs/development-plan.md`: current snapshot, phase/slice state, evidence
   log entry (date, what was verified, what was *not*) and a short founder checklist
   (≤ 8 steps) for device QA. Do not create a second competing progress tracker.
7. Commit with the required identity. Open a PR. **Stop and wait** for founder device
   feedback before the next slice. Fix reported blockers first.
8. Never: push without instruction, raise budgets, change security settings, print
   dotenv values, mark device gates passed, add social features, or add
   dependencies younger than 7 days.

## 7. Open decisions the founder must make (with deadline)

| Decision | Needed by | Default if no answer |
|---|---|---|
| Enrol Apple Developer Program + Play Console | Week 1 | Pilot slips; launch slips |
| Buy/borrow Xiaomi-class Android device | Week 2 | GPS phase cannot be verified |
| App name (trademark + store availability) | Week 8 | Working title "Unified Fitness" |
| Map library (Google Maps key vs MapLibre) | Week 9 | react-native-maps |
| Price + free AI quota | Week 19 | ₹199/mo, ₹1,299/yr, 5 estimates/day |
| Analytics vendor + consent copy | Week 17 | PostHog, events only |
| Launch date vs cut-line | Week 22 | Ship Must-only; defer Cut-line |

## 8. What is explicitly out of V1

Social feed, followers, leaderboards, challenges, cycling/swimming GPS, watch apps
(watchOS/Wear OS), Fitbit/Garmin/Strava cloud APIs, coach marketplace, meal
planning/recipes, barcode scanning (reconsider post-launch; LLM text covers packaged
food poorly — note this as a known gap), muscle heatmaps, exercise video library,
Hindi UI, web app, Apple Health *write* of nutrition (cut-line), AI chat.

## 9. Evidence log — consolidated from the retired tracker

Historical implementation facts below are evidence, not current instructions. The
snapshot/phase gates above govern next work. Full original notes are preserved in
Git history; do not resurrect obsolete chooser/draft-inbox/light-gym workflows.

| Date/checkpoint | What was built or verified | Boundary still open |
|---|---|---|
| 2026-10-05 initial audit | App was UI/in-memory data with mocked activity/photo and no tests. | No real health/GPS/gym or release infrastructure. |
| 2026-10-05 foundation | SQLite profile/typed meals/corrections, local dates, rollback/failure handling; 10 tests, bundles/typecheck. Founder later reports iPhone launch and saved-meal reopen. | Standalone offline cold start, midnight and Android not signed off. |
| 2026-10-05 history/export | Real day-based food history, readable all-day JSON, sharing/cancel paths; 18 tests. History modal uses page-sheet/swipe-down dismissal. | Source-contract tests are not UIKit gesture/share-sheet device evidence. |
| 2026-10-05 native preparation | Mature dev-client/system UI pins and non-destructive pinned-template generation; 24 tests, native config/syntax and bundles. Local Personal Team route chosen for initial testing. | Full Xcode/Android tools, signing, actual compile/install blocked or unverified. No paid membership purchase made. |
| Nutrition N1/N2 | Additive macro/unknown/revision/job/cache foundation, secure Supabase bridge and real Postgres lease/coalescing/owner/quota tests; 39 then 54 tests. | Initial paused state was later explicitly enabled; do not follow that historical setup as current. |
| Approved live text | OpenAI stable adapter, anonymous auth and US$1 current-month cap approved. Same-ID/same-user/cross-user cache proof: one model reservation across repeated completed request IDs. Founder reports save→estimate. | Cache proof is not nutrition accuracy; 808/785 report used different keys and needs exact inputs. Future budgets never renew automatically. |
| Photo implementation, `18c5f13` | Durable private JPEG capture/upload/vision, digest/owner/cache/non-food guards and editable results; 69 tests. | Camera/vision/quality phone sign-off pending. |
| Photo explicit Save, `4098352` | SQLite v3 draft/saved/discarded migration; pending offline Save, idempotent promotion, late-result protection. Isolated JWT photo preview deployed/enabled; 80 tests. | No-count-before-Save is deliberate; bundle/native generation do not prove runtime. |
| Native photo hashing, `1777178` | Reproduced Expo Crypto ArrayBuffer versus TypedArray contract; Uint8Array fix and upload-path regression; 83 tests. | Original gallery-button layout was later superseded by direct camera view. |
| Minimal results, `cf99a46` | Bottom photo macro overlay, short actions, no visible portion/assumption paragraphs; 86 tests. | Contrast, dynamic type and camera transitions require device QA. |
| Voice, `788312a` | SQLite v4 recording/jobs, private transcription/prompt-version cache, shared budget/session setup and reviewed text pipeline; 107 tests, isolated Postgres/hosted smoke. Two synthetic clips had word errors. | Audio cleanup/cache transport proof is not real-language accuracy or native microphone proof. |
| Device fixes, `6012976` | Standard AAC replaces failing custom encoder. Host-native Go audio is validated/copy-persisted into scoped project documents before queue. Done/Retry, no duplicate Type; 114 tests. Founder selects “Words appear” after retest. | Narrow iPhone checkpoint only; full macro Save/offline/Android/quality still pending. Temporary DEBUG logs removed. |
| Merge/UI, `d41c8a9` | Removed visible draft entries without deleting data. PR #1 cumulative work merged to main via non-forced fast-forward on 2026-10-10; identities preserved, no open PRs. 114 tests in both time zones, typecheck/config guard/bundles. | Merged is not Phase 0 DONE; no new backend deployment/budget increase or agent inference in that merge. |
| 2026-10-10 Phase 0 CI, `b070bb2` | Added mature SHA-pinned, read-only/no-secret/no-inference PR verification and 116-pass TAP floor. Local checks and hosted PR #2 run 38055593788 pass (locked install/config/typecheck/tests/time zones/both bundles). Founder authorizes push/PR, iPhone only available; clearer Xcode steps provided when he reports not started. | PR merge/main-green and native install/QA pending; SDK patches blocked by age until October 13 after 12:12 UTC. Homebrew JDK dependency upgrade stopped before installation; checked versions unchanged. |
| 2026-10-10 roadmap consolidation | Founder confirms expanded gym scope, requests single roadmap/tracker and deletion of the old tracker. Rechecked 114 tests/TypeScript, merged PR/no open PRs and active CLT-only Xcode toolchain. | Documentation-only change; no new feature, native install, CI execution or accuracy result. |

### Verification commands and recording policy

From `mobile/`: `yarn check:config`, `yarn typecheck`, `yarn test`,
`yarn expo export --platform ios --output-dir dist/ios`,
`yarn expo export --platform android --output-dir dist/android`.
Tests use built-in Node SQLite and TypeScript stripping; the recorded harness was
Node 25.6.1, not a new external test runner. Also run time-zone tests in
Asia/Kolkata/America/New_York for day-boundary changes. Backend entry checks use
pinned Deno; real hosted smoke requires explicit approval and an inspected budget,
never automatic CI inference. Do not print dotenv values.

New entries must state date, commit/build, actual commands or device report,
pass/fail, what remains unverified and any spending reservation. Mark only the
specific reported manual checkpoint passed. No database resets/storage clearing
for QA. Older small test counts are historical, not the current baseline.
