# Competitor & User Research

Evidence gathered Aug 2026. Confidence levels noted — do not treat any of this as
settled fact without further validation.

## 1. MyFitnessPal is actively bleeding users (HIGH confidence, GOOD news)

The 2026 MyFitnessPal redesign triggered what one competitor describes as "the
loudest wave of switching-intent in the calorie tracking category in years."

Documented complaints:
- **Tap count exploded**: 6-10 taps for what used to take 2-3. Daily logging went
  from a ~90-second routine to a ~5-minute chore.
- Food diary no longer shows calories per meal at a glance
- Removed multi-select and copy-meal shortcuts
- Tiny macro numbers, cluttered home view
- Navigation splits what used to be one screen
- Called "outdated", "ad-choked", "paywalled to death"

**Strategic implication:** This validates the core thesis and hands us a positioning
line. Our tap-count target is a hard product requirement, not an aspiration.
Caveat: several sources are competitor blogs with an incentive to exaggerate.

## 2. Photo calorie estimation is genuinely unreliable (HIGH confidence)

University of Sydney study (2024): AI food apps **overestimated calories for mixed
Asian dishes by up to 49% and underestimated others by up to 76%.** They perform
notably better on separated Western foods than on mixed dishes.

Hands-on testing (Lifehacker, Cal AI): identified a Pink Lady apple as tikka masala;
estimated 80 cal for an apple that was ~120 (-33%); estimated a mixed salad at
450 cal against a realistic 800-900.

Known weak points: hidden cooking oil and sugar, ingredients inside a sandwich,
portion size.

**Strategic implication — this is the most important finding for us.** Indian food
is *the* worst case for photo estimation: mixed dishes, oil-heavy, served in
katoris. A dal photo cannot reveal how much ghee is in it. Photo logging should be
positioned as a fast rough estimate that is always hand-correctable, never as
precision. Text/voice remains the more trustworthy primary path.

## 3. Retention is brutal (HIGH confidence, sobering)

- Health & fitness Day-30 retention: **~3%**, ranging 3-12%. Best-in-class ~47.5%.
- ~80% of users abandon a new fitness app within the first month.
- Average mobile app loses 77% of DAU within **three days**.
- Health & fitness activation falls from 26% (Day 1) to 10% (Day 28).
- Median ~70% discontinue within 100 days; steepest drop in the first two weeks.
- Annual fitness subscriptions retain ~33%.

Top stated abandonment reasons: **time-consuming manual entry**, complex onboarding,
technical issues, generic content, unclear value.

**Strategic implication:** "Time-consuming manual entry" is the #1 churn driver and
is exactly what we're attacking. But the numbers mean V1 must be designed around the
first 72 hours and the 14-day habit. Onboarding must be near-zero-effort.

## 4. HealthifyMe is the incumbent to beat in India (MEDIUM confidence)

- Claims the largest Indian food database — 20,000+ dishes, all regional cuisines.
- Already supports **Indian portion units: katoris and bowls.** We must match this;
  grams-only input is a non-starter for Indian users.
- Added AI image recognition for Indian food in 2023 (Khosla-backed).
- Their weakness (needs validation): heavy human-coach upsell, cluttered UI,
  aggressive notifications — i.e. the bloat we position against.

**Gap in research:** could not surface direct Reddit threads on HealthifyMe
complaints. Their specific weaknesses remain an assumption, not evidence.
**Action: validate before relying on it.**

## Open research gaps

- Direct Indian user complaints about HealthifyMe (assumption, unvalidated)
- Whether Indian users will pay for a fitness subscription, and at what price
- Hevy/Strava-specific complaints (not yet researched)
- Whether "three apps in one" is a stated user desire or our own hypothesis

## Sources

- https://platelens.app/blog/myfitnesspal-alternatives-2026
- https://www.hootfitness.com/blog/why-users-are-switching-from-myfitnesspal-and-what-they-re-choosing-instead
- https://www.eesel.ai/blog/cal-ai
- https://sahha.ai/blog/health-app-churn-retention/
- https://retentioncheck.com/churn-benchmarks/fitness-apps
- https://vocal.media/01/why-most-fitness-apps-lose-80-of-users-in-30-days
- https://en.wikipedia.org/wiki/HealthifyMe
- https://techcrunch.com/2023/09/21/khosla-backed-healtifyme-introduces-ai-powered-image-recognition-for-indian-food/
