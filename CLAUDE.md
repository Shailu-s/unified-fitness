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

Pre-code. Stack not yet committed. PDF proposes React Native (Expo) +
HealthKit/Health Connect + LLM API — a proposal under review, not a decision.
