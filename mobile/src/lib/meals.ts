import type { MealInput, SavedMeal } from '../types';

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function shiftLocalDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || localDateKey(date) !== day) {
    throw new Error('Invalid calendar day.');
  }
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
}

export function validateMealInput(input: MealInput): MealInput {
  const name = input.name.trim();
  if (!name) throw new Error('Enter a meal description.');
  const values = [input.kcal, input.protein, input.fibre];
  const hasNutrition = values.some((value) => value !== null);
  if (hasNutrition && values.some((value) => value === null || !Number.isFinite(value) || value < 0)) {
    throw new Error('Enter all three nutrition values as nonnegative numbers, or leave all blank.');
  }
  return { ...input, name, portion: input.portion.trim() || 'Portion not specified' };
}

export function sumNutrition(meals: SavedMeal[]) {
  return meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + (meal.kcal ?? 0),
      protein: sum.protein + (meal.protein ?? 0),
      fibre: sum.fibre + (meal.fibre ?? 0),
      pending: sum.pending + Number(meal.nutritionStatus === 'pending'),
    }),
    { kcal: 0, protein: 0, fibre: 0, pending: 0 },
  );
}
