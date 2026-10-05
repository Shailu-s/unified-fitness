import type { MealInput, NutritionEstimate } from '../types.ts';

export const NUTRITION_CACHE_VERSION = 'nutrition-v1';
const normalize = (text: string) => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

export function nutritionCacheKey(input: MealInput): string | null {
  if (input.inputType === 'photo') return null;
  return JSON.stringify([NUTRITION_CACHE_VERSION, 'en-IN', normalize(input.name), normalize(input.portion)]);
}

export function validateEstimate(value: unknown): NutritionEstimate {
  if (!value || typeof value !== 'object') throw new Error('Invalid nutrition estimate.');
  const estimate = value as Record<string, unknown>;
  if (estimate.version !== 1 || typeof estimate.model !== 'string' || !estimate.model.trim() || estimate.model.length > 100) {
    throw new Error('Invalid estimate version or model.');
  }
  const values = ['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const;
  for (const key of values) {
    const number = estimate[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > (key === 'kcal' ? 20000 : 5000)) {
      throw new Error('Invalid estimate nutrition values.');
    }
  }
  if (!Array.isArray(estimate.assumptions) || estimate.assumptions.length > 12 ||
    estimate.assumptions.some((item) => typeof item !== 'string' || item.length > 300)) {
    throw new Error('Invalid estimate assumptions.');
  }
  if (estimate.foods !== undefined && (!Array.isArray(estimate.foods) || estimate.foods.length > 12 ||
    estimate.foods.some((food) => !food || typeof food.name !== 'string' || !food.name.trim() || food.name.length > 100 ||
      typeof food.portion !== 'string' || !food.portion.trim() || food.portion.length > 160))) throw new Error('Invalid identified foods.');
  return {
    ...(estimate.foods ? { foods: estimate.foods.map((food: { name: string; portion: string }) => ({ name: food.name.trim(), portion: food.portion.trim() })) } : {}),
    version: 1, model: estimate.model.trim(), kcal: estimate.kcal as number, protein: estimate.protein as number,
    carbs: estimate.carbs as number, fat: estimate.fat as number, fibre: estimate.fibre as number,
    assumptions: [...estimate.assumptions],
  };
}
