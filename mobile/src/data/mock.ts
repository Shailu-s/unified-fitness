import type { Activity, Diet, Meal, MealTemplate, Profile } from '../types';

// Dev switches.
// SKIP_ONBOARDING: jump straight to Home using mockProfile.
// SEED_TODAY: false shows the empty Log state (a brand new user at 7am).
export const SKIP_ONBOARDING = false;
export const SEED_TODAY = true;

// Feeds onboarding defaults and the skip switch. These values
// produce 2,100 kcal, 120 g protein, 30 g fibre, matching the design.
export const mockProfile: Profile = {
  name: 'Sahil',
  sex: 'male',
  age: 28,
  heightCm: 172,
  weightKg: 70,
  goal: 'lose',
  diet: 'veg',
};

export const mockActivity: Activity = {
  steps: { value: 8742, goal: 10000 },
  move: { value: 230, goal: 300 },
  exercise: { value: 18, goal: 30 },
  stand: { value: 9, goal: 12 },
  burned: 412,
};

// Totals: 1,340 kcal, 68 g protein, 19 g fibre.
export const mockMeals: Meal[] = [
  { id: 'm1', emoji: '🍳', name: 'Poha with peanuts', time: '08:20', portion: '1 plate', kcal: 320, protein: 10, fibre: 4 },
  { id: 'm2', emoji: '🥤', name: 'Whey shake', time: '11:05', portion: '1 scoop', kcal: 110, protein: 24, fibre: 0 },
  { id: 'm3', emoji: '🍛', name: 'Dal, 2 roti, sabzi', time: '13:45', portion: '1 katori + 2', kcal: 610, protein: 22, fibre: 10 },
  { id: 'm4', emoji: '🥜', name: 'Roasted chana', time: '16:15', portion: '1 bowl', kcal: 180, protein: 9, fibre: 5 },
  { id: 'm5', emoji: '☕', name: 'Chai with sugar', time: '17:10', portion: '1 cup', kcal: 120, protein: 3, fibre: 0 },
];

// One tap logs these. Starter sets by diet, replaced by real habits later.
const chai: MealTemplate = { emoji: '☕', name: 'Chai', portion: '1 cup', kcal: 120, protein: 3, fibre: 0 };

export const mockUsuals: Record<Diet, MealTemplate[]> = {
  veg: [{ emoji: '🍳', name: 'Poha', portion: '1 plate', kcal: 320, protein: 10, fibre: 4 }, chai],
  egg: [{ emoji: '🥚', name: 'Boiled eggs', portion: '2 eggs', kcal: 155, protein: 12, fibre: 0 }, chai],
  nonveg: [{ emoji: '🍳', name: 'Egg bhurji', portion: '2 eggs + 1 roti', kcal: 290, protein: 16, fibre: 3 }, chai],
};

// Stand-in for what a photo scan would return. The shutter cycles through these.
export const mockPhotoLogs: MealTemplate[] = [
  { emoji: '🥣', name: 'Idli, sambar', portion: '3 idli', kcal: 280, protein: 9, fibre: 4 },
  { emoji: '🍚', name: 'Rajma chawal', portion: '1 plate', kcal: 520, protein: 18, fibre: 9 },
  { emoji: '🍌', name: 'Banana', portion: '1 medium', kcal: 105, protein: 1, fibre: 3 },
  { emoji: '🧀', name: 'Paneer tikka', portion: '6 pieces', kcal: 300, protein: 20, fibre: 2 },
];
