# Unified Fitness (Expo, React Native, TypeScript)

## Run it

```bash
npx create-expo-app@latest unified-fitness --template blank-typescript
cd unified-fitness
npx expo install react-native-svg react-native-safe-area-context expo-font \
  @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
```

Copy `App.tsx` and `src/` from this zip over the generated ones, then:

```bash
npx expo start
```

In `app.json`, set `"userInterfaceStyle": "light"` so the paper theme is never inverted.

## Dev switches (`src/data/mock.ts`)

- `SKIP_ONBOARDING = true` jumps straight to Home as the mock user.
- `SEED_TODAY = false` starts the Log screen empty, so you see the empty state and the "usuals".

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
