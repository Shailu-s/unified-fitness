import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { SEED_TODAY, SKIP_ONBOARDING, mockActivity, mockMeals, mockProfile } from '../data/mock';
import { hhmm } from '../lib/format';
import { computeTargets } from '../lib/targets';
import type { Activity, Meal, MealTemplate, Profile, Targets } from '../types';

interface AppState {
  profile: Profile | null;
  targets: Targets;
  meals: Meal[];
  eaten: { kcal: number; protein: number; fibre: number };
  activity: Activity;
  completeOnboarding: (p: Profile) => void;
  addMeal: (t: MealTemplate) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(SKIP_ONBOARDING ? mockProfile : null);
  const [meals, setMeals] = useState<Meal[]>(SEED_TODAY ? mockMeals : []);

  // Falls back to the mock profile only so the value is never null; Main renders after onboarding.
  const targets = useMemo(() => computeTargets(profile ?? mockProfile), [profile]);

  const eaten = useMemo(
    () =>
      meals.reduce(
        (sum, m) => ({ kcal: sum.kcal + m.kcal, protein: sum.protein + m.protein, fibre: sum.fibre + m.fibre }),
        { kcal: 0, protein: 0, fibre: 0 },
      ),
    [meals],
  );

  const addMeal = useCallback((t: MealTemplate) => {
    setMeals((prev) => [...prev, { ...t, id: Math.random().toString(36).slice(2), time: hhmm(new Date()) }]);
  }, []);

  const value: AppState = { profile, targets, meals, eaten, activity: mockActivity, completeOnboarding: setProfile, addMeal };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
