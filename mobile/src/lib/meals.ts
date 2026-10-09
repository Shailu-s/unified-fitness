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

export function validateMealInput(input: MealInput) {
  const inputType = input.inputType ?? 'text';
  const name = input.name.trim() || (inputType === 'photo' ? 'Photo meal' : '');
  const portion = input.portion.trim() || 'Portion not specified';
  if (!name || name.length > 500 || portion.length > 500) throw new Error('Enter a meal description of at most 500 characters.');
  if (inputType !== 'text' && inputType !== 'photo') throw new Error('Invalid meal input type.');
  const photoUri = input.photoUri ?? null;
  if (inputType === 'photo' && !photoUri) throw new Error('A photo file is required.');
  if (photoUri && (!photoUri.startsWith('file:///') || inputType !== 'photo')) throw new Error('Use a local photo file.');
  const values = [input.kcal, input.protein, input.fibre];
  const hasNutrition = values.some((value) => value !== null);
  if (hasNutrition && values.some((value) => value === null || !Number.isFinite(value) || value < 0)) {
    throw new Error('Enter calories, protein and fibre as nonnegative numbers, or leave nutrition blank.');
  }
  const carbs = input.carbs ?? null;
  const fat = input.fat ?? null;
  if ((carbs !== null || fat !== null) && (!hasNutrition || [carbs, fat].some((value) => value === null || !Number.isFinite(value) || value < 0))) {
    throw new Error('Enter both carbs and fat as nonnegative numbers, or leave both blank.');
  }
  return { name, portion, kcal: input.kcal, protein: input.protein, fibre: input.fibre, carbs, fat, inputType, photoUri };
}

export function sumNutrition(meals: SavedMeal[]) {
  return meals.filter((meal) => !meal.logState || meal.logState === 'saved').reduce(
    (sum, meal) => ({
      kcal: sum.kcal + (meal.kcal ?? 0),
      protein: sum.protein + (meal.protein ?? 0),
      fibre: sum.fibre + (meal.fibre ?? 0),
      pending: sum.pending + Number(meal.nutritionStatus === 'pending'),
      carbs: meal.carbs == null ? sum.carbs : (sum.carbs ?? 0) + meal.carbs,
      fat: meal.fat == null ? sum.fat : (sum.fat ?? 0) + meal.fat,
    }),
    { kcal: 0, protein: 0, fibre: 0, pending: 0, carbs: null as number | null, fat: null as number | null },
  );
}
