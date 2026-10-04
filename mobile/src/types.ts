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
  nutritionStatus: 'pending' | 'manual';
}

export type MealInput = Pick<Meal, 'name' | 'portion' | 'kcal' | 'protein' | 'fibre'>;

export interface ExportData {
  profile: Profile | null;
  meals: SavedMeal[];
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
