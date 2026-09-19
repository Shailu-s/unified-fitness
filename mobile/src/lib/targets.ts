import type { Profile, Targets } from '../types';

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// Mifflin-St Jeor, a flat light-activity factor, then a goal adjustment.
export function computeTargets(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'goal'>): Targets {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * 1.4;

  const kcalAdjust = { lose: -200, maintain: 0, build: 250 }[p.goal];
  const proteinPerKg = { lose: 1.7, maintain: 1.4, build: 1.8 }[p.goal];

  const kcal = roundTo(tdee + kcalAdjust, 50);
  return {
    kcal,
    protein: roundTo(p.weightKg * proteinPerKg, 5),
    fibre: Math.max(25, roundTo((kcal / 1000) * 14, 5)),
  };
}
