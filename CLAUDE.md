# Unified Fitness

One app replacing three: **Strava-style cardio + Apple-Fitness-style activity rings +
calorie/macro tracking**. Light gym logging included. Minimal, fast, clutter-free.

Source concept: `unified_fitness_concept.pdf` — read it for context, but **the persona
and scope below supersede it** (see "Deviations from the PDF").

## Fixed context (decided with the founder — do not re-litigate without asking)

| Dimension | Decision |
|---|---|
| Primary user | Indian IT employee. Walks, tries to stay healthy, goes to the gym ~2-4x/week. **Not** a hardcore athlete. |
| Market | India first, designed so global is possible later. |
| Wedge | The **unification itself** — three-in-one dashboard, not beating any single incumbent at its own game. |
| Gym scope | **Light logging only.** No volume math, no muscle heatmaps, no powerlifter UI. |
| Monetization | Freemium subscription. Free core tracking; paid tier TBD. |
| Capacity | ~10-15h/week, nights and weekends. This is the binding constraint on all scope. |
| Platforms | **Both iOS and Android simultaneously.** Founder decision, made against a recommendation to ship Android-first. |
| Live GPS | **In V1.** Founder decision — "Strava-grade" is core to the pitch; imported-only cardio is not acceptable. |
| Food data | **LLM estimates everything**, no curated seed DB. Founder decision. Caching is mandatory (see below). |
| Goal | Real business, not a portfolio piece. |

## Deviations from the PDF (deliberate)

- Persona changed from "hybrid athlete" to "IT employee staying healthy." Larger
  market, lower tolerance for complexity.
- Hevy-style deep strength logging is **out**. Light logging replaces it.
- The dashboard/unification is the product; logging pillars serve it.
- Photo-based calorie estimation is treated as unproven and low-trust — text/voice
  parsing is the primary path.

## Working relationship

Shailendra is the founder; Claude acts as technical co-founder, not an order-taker.

- **Critique before building.** Name known failure modes first, with reasoning.
  Unearned agreement is worthless here.
- **Ground claims in evidence.** When citing user demand or competitor failure
  (Reddit, App Store reviews, teardowns), say the source and the confidence level.
  Never invent user research.
- **Recommend, don't survey.** One recommendation with tradeoffs beats five options.
- **Defend the scope.** Every feature must justify itself against: *does the Indian
  IT employee need this in V1, at 12h/week?* The app's premise is not being bloated.
- **Ask when the answer changes the build.**

## Product principles

1. **Minimalism is the product.** Feature parity with incumbents is an anti-goal.
2. **Speed is a feature.** Logging latency and tap-count are bugs, not polish.
3. **Offline-first.** Gyms and Indian commutes have bad signal. Nothing critical
   may require a network round-trip. Full offline use, sync later.
4. **The OS does the heavy lifting.** Prefer HealthKit / Health Connect over custom
   background tracking (battery, permissions, store-review risk).
5. **Data belongs to the user.** Export from V1.
6. **Never block a log on a network or model call.** LLM macro parsing is async,
   fails soft, and is always hand-correctable.

## Known hard problems (do not hand-wave these)

- **LLM cost scaling.** Founder chose LLM-estimates-everything for food. Therefore
  **aggressive caching is not optional** — parse results must be cached locally and
  shared server-side, keyed on normalized phrasing. The 50th user logging
  "2 roti dal chawal" must hit cache, never the API. Build this in from day one;
  retrofitting is far harder. This also fixes estimate inconsistency, which erodes
  user trust when the same meal logs differently day to day.
- **Android background GPS.** Doze mode plus OEM battery killers (Xiaomi, Oppo,
  Vivo, OnePlus) aggressively kill background services — and those are exactly the
  phones Indian users own. Highest one-star-review risk in the product. Test on a
  real Xiaomi/Realme device, not just an emulator.
- **Dual-platform health layer.** HealthKit and Health Connect differ in permission
  models, data shapes, and background behavior. Quarantine the divergence behind a
  strict platform-abstraction module so it does not smear across the app.
- **Indian food coverage.** Western DBs cover roti/dal/sabzi/restaurant chains
  poorly. Mitigated by the LLM approach, but portion sizing ("1 katori", "medium
  roti") remains genuinely ambiguous and needs a good correction UX.
- **Freemium needs accounts + billing** without compromising offline-first.
- **Retention, not acquisition, kills fitness apps.** Most users quit within weeks.
  Design V1 around the 14-day habit, not around feature count.

## Engineering standards

- Local-first data model with sync — not a thin client over a remote API.
- Every user-facing write must survive app kill and cold start mid-session.
- Record architecture decisions with reasoning in `docs/decisions/`, not just outcomes.
- Prefer boring, well-supported tech. At 12h/week there is no budget for fighting tools.

## Status

Expo / React Native / TypeScript app exists under `mobile/`. Slice 1.1 now has
SQLite-backed profile and typed food logging with manual corrections and explicit
unknown nutrition. Slice 1.2 adds separate calendar history and local JSON export
(profile + all saved meals) through the native share sheet. Activity remains demo
data. iPhone Expo Go reopen persistence passed per founder; native history/sharing
and full offline cold-start verification are pending. GPS, health integration,
LLM estimates, sync, and billing are not built. Native dev-client setup and
non-destructive project generation are prepared; native compilation/install stays
blocked on full Xcode (currently only Command Line Tools) and Android SDK access.

Build sequence and progress: `docs/build-plan.md`. Architecture reasoning:
`docs/decisions/001-local-first-logging.md`.

## Development and verification

Use existing Yarn 1 lockfile. From `mobile/`:

- Install: `yarn install --frozen-lockfile`
- Expo Go preview: `yarn start` (explicit Go, port 8082)
- Native projects: `yarn native:generate` (no install/clean, pinned SDK-57 template)
- iPhone build: `yarn ios:device` (requires full Xcode and device signing)
- Android build: `yarn android:device` (requires Android SDK/JDK)
- Installed dev-client server: `yarn start:dev` (port 8083)
- Typecheck: `yarn typecheck`
- Tests: `yarn test` (built-in Node SQLite and TypeScript stripping; verified on Node 25.6.1)
- iOS bundle: `yarn expo export --platform ios --output-dir dist/ios`
- Android bundle: `yarn expo export --platform android --output-dir dist/android`

Bundle checks are not native runtime tests. Physical offline save/edit/force-stop/
reopen checks are required on both platforms before marking persistence DONE.
Update the build tracker after each slice; keep unverified device gates unchecked.

## Founder testing workflow

Build one slice, run automated checks, provide a runnable app and a short manual
checklist, then wait for Shailendra's feedback before starting the next slice.
Record reported results and fix blockers first. Do not claim manual testing passed
until the founder reports it. Keep replies short and actionable.

Commit each meaningful feature slice or bug fix after automated checks; avoid
micro-commits and giant mixed changes. Include the relevant tests and tracker
updates. Keep unverified manual gates pending. Never push unless explicitly asked.
