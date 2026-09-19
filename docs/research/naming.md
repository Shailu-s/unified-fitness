# App Naming — research & options

## Constraints established by research

**App store rules (Apple/Google, ASO best practice)**
- Target **10–15 characters**. Shorter is better for the home-screen label.
- Name must be simple to pronounce, easy to remember, and describe what the app
  does without hype.
- Banned in titles/subtitles: "free", "cheap", "discount", "#1".
- Generic names ("Photo Editor", "Calorie Tracker") rank badly and cannot be
  defended as a trademark.
- Common pattern: `Brand — one or two keywords` balances brand vs discoverability.
  Keyword stuffing hurts conversion.

**Trademark**
- Search before committing; file before store launch.
- A name too close to an existing fitness mark is a real legal risk, not theoretical.

**Domain checking — the method matters**
> ⚠️ An earlier pass of this research reported nearly everything as "taken".
> That was a **tooling bug**, not a finding: bare `whois <domain>` on this machine
> hits the IANA root server and returns TLD metadata, never querying the domain.
> Every result from that pass was invalid and has been discarded.

Correct usage:
```bash
whois -h whois.verisign-grs.com example.com   # .com  -> "No match for" = free
whois -h whois.nic.google      example.app   # .app  -> "Domain not found" = free
```
Always sanity-check against a control string that must be free.

**What is actually available (verified Aug 2026)**
- Short 3–5 letter `.com`/`.app` words: essentially all taken (squatted).
- Obvious keyword combos (`myfitnesslog`, `mydailyfit`, `myhealthpal`): taken.
- **Descriptive multi-word names: widely available.** Squatters chase short names,
  so length works in our favour.

## OmniFit — verdict: do not use

Founder's suggestion. It is already crowded:
- **Omnifit, LLC** owns registered trademarks including OMNIFIT and FITNATION
  (filed 2013–2018), covering fitness facilities.
- **OmniFit Performance** — existing coaching app on Google Play.
- **Omnifit** — existing fitness app on Google Play.
- **Omni-Fit** — another existing app on Google Play.
- **OmniFit Personal Fitness Training** (San Diego), operating as JJ4E LLC.

Four live apps plus a registered mark in the exact category. This is the one
outcome that is unambiguously disqualifying.

Also worth noting: "Omni" + "Fit" is the single most predictable construction for
a unify-everything fitness app, which is why four teams already got there.

## Arc — verdict: do not use

Founder liked it (the home screen is literally arcs). Already crowded in-category:
**ARC Fitness** (Google Play + App Store), **MyARC Fitness**, **ARC Gym**, **Arc.**
Same failure mode as OmniFit — four apps competing for the name on day one.
Arc Browser also owns the word culturally in software.

## Name length — corrected

An earlier pass over-applied the "10–15 characters" ASO guidance. That guidance is
about the **home-screen label**, not a rule that short names win. MyFitnessPal is
13 characters and dominant; Healthify is 9.

Longer descriptive names are **better** for this project: more available, and the
words themselves carry the search keywords.

## How app store SEO actually works

Founder asked whether a name like "OmniFit" helps SEO. Important correction:

- ASO ranks on the **keyword field and subtitle**, not the brand name alone.
- So a distinctive brand + descriptive subtitle gets *both*:
  `Kova — Calorie & Step Tracker`
- A name containing "Fit" makes you compete for a generic term against
  MyFitnessPal, Fitbit, Fittr and thousands more — unwinnable.
- Strava, Hevy and Whoop mean nothing literally; they rank via metadata and own
  their names outright.

**Rule for this project: own the brand word, rent the keywords in the subtitle.**

## Verified-free candidates (Aug 2026, .com)

| Domain | Status |
|---|---|
| myfitnessledger.com | FREE |
| myfitnessring.com | FREE |
| dailyplatelog.com | FREE |
| plateandpace.com | FREE |
| everydayfitlog.com | FREE |
| dailyfitcircle.com | FREE |
| myfitnessorbit.com | FREE |

Confirmed taken: myfitnesslog, myhealthpal, mydailyfit, myfuelpal, mymacrolog,
fitnessledger, myplatepal, myfitnesscircle, healthlyft, dayfuel, mymacropal.

## Current shortlist

1. **MyFitnessRing** — describes the actual product (the home screen is a ring),
   familiar `My___` construction, strong keywords, shorter than MyFitnessPal.
   *Risk:* "Ring" sits close to Apple's Activity Ring vocabulary — needs a
   trademark check before committing.
2. **MyFitnessLedger** — a ledger is a record of accounts, which is exactly what
   the app is. Distinctive, matches the precise mono-numeral design.
   *Risk:* 16 chars; "Ledger" carries a crypto-wallet association.
3. **PlateAndPace** — plate (food) + pace (movement) = the unification pitch in
   two words. Most distinctive. *Risk:* no "fit"/"health" keyword in the name.

**Not yet done for any of these: trademark search + App Store / Play Store search.**
That check is what disqualified OmniFit and Arc. Do it before committing.

## Rejected directions

- **Hindi/Sanskrit names** (Tarka, Kadam, Nira, Sattvi, Khaata…) — founder rejected;
  wants a modern name, not an Indian-language one.
- **Very short invented words** (Kova, Volu, Ovo, Nulo) — viable but founder prefers
  a longer descriptive name in the MyFitnessPal register.
- **Names to avoid outright:** Halo (Amazon Halo was a fitness band), Tally (major
  Indian accounting brand), Lapse (means relapse), Vella (Hindi slang for idle),
  Nulo (pet food brand), Nomi (existing AI app).

## The naming strategy question

Two viable directions, and they imply different companies:

1. **Descriptive/English** — instantly clear, globally scalable, but crowded and
   hard to trademark. Every `-Fit`, `-Track`, `-Log` name is fought over.
2. **Indian-rooted** — distinctive, defensible, signals "built for India" which is
   the actual differentiator against MyFitnessPal. Risk: harder to scale globally
   later, and mispronunciation outside India.

Given the positioning (India-first, against a US incumbent users find bloated),
direction 2 is the stronger strategic bet — provided the word is short and
pronounceable by a non-Hindi speaker.

## Sources

- https://www.apptweak.com/en/aso-blog/app-name-guidelines-and-best-practices
- https://www.mobileaction.co/blog/how-to-name-an-app/
- https://trademarks.justia.com/owners/omnifit-llc-1719573
- https://play.google.com/store/apps/details?id=com.trainerize.omnifit
- https://thenextweb.com/news/7-common-mistakes-avoid-naming-app
- https://play.google.com/store/apps/details?id=com.netpulse.mobile.arcfitness
- https://apps.apple.com/us/app/arc-fitness/id1218918940
- https://asoworld.com/en/insight/aso-guide-how-to-choose-the-best-name-for-your-app/
