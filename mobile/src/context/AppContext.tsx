import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as NativeAppState } from 'react-native';
import { openDatabaseSync } from 'expo-sqlite';
import { mockActivity, mockProfile } from '../data/mock';
import { LoggingRepository } from '../lib/loggingRepository';
import { localDateKey, sumNutrition } from '../lib/meals';
import { computeTargets } from '../lib/targets';
import { nutritionBackendConfig, photoEstimatesEnabled, requestNutrition } from '../lib/supabaseNutrition';
import { processNutritionJobs } from '../lib/nutritionWorker';
import type { Activity, ExportData, MealInput, Profile, SavedMeal, Targets } from '../types';

interface AppState {
  profile: Profile | null;
  targets: Targets;
  meals: SavedMeal[];
  eaten: ReturnType<typeof sumNutrition>;
  activity: Activity;
  ready: boolean;
  storageError: string | null;
  retryStorage: () => void;
  completeOnboarding: (p: Profile) => void;
  addMeal: (input: MealInput) => SavedMeal;
  getMeal: (id: string) => SavedMeal;
  retryEstimate: (id: string) => void;
  removePhoto: (id: string) => SavedMeal;
  photosEnabled: boolean;
  updateMeal: (id: string, input: MealInput) => SavedMeal;
  getMealsForDay: (day: string) => SavedMeal[];
  getMealDays: () => string[];
  getExportData: () => ExportData;
  estimatesEnabled: boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repository = useRef<LoggingRepository | null>(null);
  const day = useRef(localDateKey(new Date()));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const photosEnabled = photoEstimatesEnabled();
  const processing = useRef(false);
  const active = useRef(NativeAppState.currentState === 'active');
  const alive = useRef(true);
  const estimatesEnabled = useMemo(() => {
    try { return nutritionBackendConfig()?.enabled ?? false; } catch { return false; }
  }, []);

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

  const kickEstimates = useCallback(() => {
    if (!estimatesEnabled || !repository.current || processing.current || !active.current) return;
    processing.current = true;
    void processNutritionJobs(repository.current, requestNutrition, () => {
      if (alive.current) refreshMeals(true);
    }, () => alive.current && active.current, () => new Date(), photosEnabled ? ['text','photo'] : ['text']).catch(() => {
      if (alive.current) setStorageError('Could not process local estimation jobs. Your saved meals remain intact.');
    }).finally(() => { processing.current = false; });
  }, [estimatesEnabled, photosEnabled, refreshMeals]);

  useEffect(() => {
    alive.current = true;
    retryStorage();
    return () => { alive.current = false; };
  }, [retryStorage]);

  useEffect(() => {
    if (!ready) return;
    active.current = NativeAppState.currentState === 'active';
    kickEstimates();
    const workerTimer = setInterval(kickEstimates, 15000);
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
      active.current = state === 'active';
      if (state === 'active') {
        refresh(true);
        kickEstimates();
        clearTimeout(timer);
        scheduleMidnight();
      }
    });
    return () => { clearTimeout(timer); clearInterval(workerTimer); subscription.remove(); };
  }, [ready, refreshMeals, kickEstimates]);

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
    kickEstimates();
    return saved;
  }, [requireRepository, refreshMeals, kickEstimates]);

  const updateMeal = useCallback((id: string, input: MealInput) => {
    refreshMeals();
    const saved = requireRepository().updateMeal(id, input);
    setMeals((previous) => previous.map((meal) => meal.id === id ? saved : meal));
    kickEstimates();
    return saved;
  }, [requireRepository, refreshMeals, kickEstimates]);

  const getMeal = useCallback((id: string) => requireRepository().getMeal(id), [requireRepository]);
  const retryEstimate = useCallback((id: string) => { requireRepository().retryNutritionJob(id); refreshMeals(true); kickEstimates(); }, [requireRepository, refreshMeals, kickEstimates]);
  const removePhoto = useCallback((id: string) => { const meal = requireRepository().removePhoto(id); refreshMeals(true); return meal; }, [requireRepository, refreshMeals]);
  const getMealsForDay = useCallback((day: string) => requireRepository().getMeals(day), [requireRepository]);
  const getMealDays = useCallback(() => requireRepository().getMealDays(), [requireRepository]);
  const getExportData = useCallback(() => requireRepository().getExportData(), [requireRepository]);

  const value: AppState = {
    profile, targets, meals, eaten, activity: mockActivity, ready, storageError, retryStorage,
    completeOnboarding, addMeal, updateMeal, getMealsForDay, getMealDays, getExportData, estimatesEnabled, getMeal, retryEstimate, removePhoto, photosEnabled,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
