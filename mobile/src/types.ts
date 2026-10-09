export type Goal = 'lose' | 'maintain' | 'build';
export type Sex = 'male' | 'female';
export type Diet = 'veg' | 'egg' | 'nonveg';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  diet: Diet;
}

export interface Targets {
  kcal: number;
  protein: number; // g
  fibre: number; // g
}

export interface Meal {
  id: string;
  emoji: string;
  name: string;
  time: string; // HH:MM
  portion: string;
  kcal: number | null;
  protein: number | null;
  fibre: number | null;
}

export interface SavedMeal extends Meal {
  createdAt: string;
  updatedAt: string;
  loggedDate: string;
  nutritionStatus: 'pending' | 'manual' | 'estimated';
  logState: 'draft' | 'saved' | 'discarded';
  carbs: number | null;
  fat: number | null;
  inputType: 'text' | 'photo';
  photoUri: string | null;
  revision: number;
  assumptions: string[];
  estimateModel: string | null;
  estimateState: 'queued' | 'running' | 'failed' | 'estimated' | 'manual';
  foods: { name: string; portion: string }[];
  estimateError: string | null;
}

export type MealInput = Pick<Meal, 'name' | 'portion' | 'kcal' | 'protein' | 'fibre'> & {
  carbs?: number | null;
  fat?: number | null;
  inputType?: 'text' | 'photo';
  photoUri?: string | null;
};

export interface NutritionEstimate {
  version: 1;
  model: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  assumptions: string[];
  foods?: { name: string; portion: string }[];
}

export interface NutritionJob {
  id: string;
  mealId: string;
  revision: number;
  input: MealInput;
  cacheKey: string | null;
  state: 'queued' | 'running' | 'failed' | 'completed' | 'cancelled';
  attempts: number;
  nextAttemptAt: string;
  leaseUntil: string | null;
  leaseToken: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportData {
  profile: Profile | null;
  meals: SavedMeal[];
  drafts?: SavedMeal[];
}

// A meal before it has an id and a time, e.g. a "usual" or a photo result.
export type MealTemplate = Omit<Meal, 'id' | 'time'>;

export interface Progress {
  value: number;
  goal: number;
}

export interface Activity {
  steps: Progress;
  move: Progress; // active kcal
  exercise: Progress; // minutes
  stand: Progress; // hours
  burned: number; // total kcal burned today
}
