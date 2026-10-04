import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as NativeAppState } from 'react-native';
import { openDatabaseSync } from 'expo-sqlite';
import { mockActivity, mockProfile } from '../data/mock';
import { LoggingRepository } from '../lib/loggingRepository';
import { localDateKey, sumNutrition } from '../lib/meals';
import { computeTargets } from '../lib/targets';
import type { Activity, MealInput, Profile, SavedMeal, Targets } from '../types';

interface AppState {
  profile: Profile | null;
  targets: Targets;
  meals: SavedMeal[];
  eaten: { kcal: number; protein: number; fibre: number; pending: number };
  activity: Activity;
  ready: boolean;
  storageError: string | null;
  retryStorage: () => void;
  completeOnboarding: (p: Profile) => void;
  addMeal: (input: MealInput) => void;
  updateMeal: (id: string, input: MealInput) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repository = useRef<LoggingRepository | null>(null);
  const day = useRef(localDateKey(new Date()));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const requireRepository = useCallback(() => {
    if (!repository.current) throw new Error('Local storage is not ready. Please try again.');
    return repository.current;
  }, []);

  const refreshMeals = useCallback((force = false, date = new Date()) => {
    const today = localDateKey(date);
    if (force || today !== day.current) {
      const saved = requireRepository().getMeals(today);
      day.current = today;
      setMeals(saved);
    }
  }, [requireRepository]);

  const retryStorage = useCallback(() => {
    setStorageError(null);
    setReady(false);
    try {
      const store = repository.current ?? new LoggingRepository(openDatabaseSync('unified-fitness.db'));
      store.initialize();
      const savedProfile = store.getProfile();
      const today = localDateKey(new Date());
      const savedMeals = store.getMeals(today);
      repository.current = store;
      day.current = today;
      setProfile(savedProfile);
      setMeals(savedMeals);
      setReady(true);
    } catch {
      setStorageError('Could not open local data. Your data has not been reset. Retry, or check device storage and app version.');
    }
  }, []);

  useEffect(() => { retryStorage(); }, [retryStorage]);

  useEffect(() => {
    if (!ready) return;
    const refresh = (force: boolean) => {
      try { refreshMeals(force); }
      catch { setStorageError('Could not read your logs. Check device storage and retry.'); }
    };
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => { refresh(false); scheduleMidnight(); }, midnight.getTime() - now.getTime() + 50);
    };
    scheduleMidnight();
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh(true);
        clearTimeout(timer);
        scheduleMidnight();
      }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [ready, refreshMeals]);

  // Falls back to the mock profile only so the value is never null; Main renders after onboarding.
  const targets = useMemo(() => computeTargets(profile ?? mockProfile), [profile]);
  const eaten = useMemo(() => sumNutrition(meals), [meals]);

  const completeOnboarding = useCallback((p: Profile) => {
    requireRepository().saveProfile(p);
    setProfile(p);
  }, [requireRepository]);

  const addMeal = useCallback((input: MealInput) => {
    const date = new Date();
    refreshMeals(false, date);
    const saved = requireRepository().addMeal(input, date);
    setMeals((previous) => [...previous, saved]);
  }, [requireRepository, refreshMeals]);

  const updateMeal = useCallback((id: string, input: MealInput) => {
    refreshMeals();
    const saved = requireRepository().updateMeal(id, input);
    setMeals((previous) => previous.map((meal) => meal.id === id ? saved : meal));
  }, [requireRepository, refreshMeals]);

  const value: AppState = {
    profile, targets, meals, eaten, activity: mockActivity, ready, storageError, retryStorage,
    completeOnboarding, addMeal, updateMeal,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
