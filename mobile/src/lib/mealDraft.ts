import type { MealInput, SavedMeal } from '../types';
import { validateMealInput } from './meals.ts';

export interface MealDraft {
  name: string;
  portion: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
}

function nutritionValue(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  return /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value) ? Number(value.replace(',', '.')) : NaN;
}

export function mealDraftInput(meal: SavedMeal | null, draft: MealDraft): MealInput {
  const nutrition = {
    kcal: nutritionValue(draft.kcal), protein: nutritionValue(draft.protein),
    carbs: nutritionValue(draft.carbs), fat: nutritionValue(draft.fat), fibre: nutritionValue(draft.fibre),
  };
  const unchangedEstimate = meal?.nutritionStatus === 'estimated' &&
    (Object.keys(nutrition) as (keyof typeof nutrition)[]).every((key) => nutrition[key] === meal[key]);
  return validateMealInput({
    name: draft.name, portion: draft.portion,
    ...(unchangedEstimate ? { kcal: null, protein: null, carbs: null, fat: null, fibre: null } : nutrition),
    inputType: meal?.inputType ?? 'text', photoUri: meal?.photoUri ?? null,
  });
}
