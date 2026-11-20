import type { DietDay, FullDietPlan } from './types';
import { portion, sum, type Macros } from './nutrition';

type Day = FullDietPlan['days'][number];
type Meal = Day['meals'][number];

export const DISCLAIMER =
  'Este plan es una guía general armada por tu entrenador para acompañar tu entrenamiento. No reemplaza la consulta con un nutricionista o médico: si tenés alguna condición de salud o querés un plan más detallado, consultá con un profesional de la nutrición.';

export const mealTotals = (meal: Meal): Macros => sum(meal.items.map((i) => portion(i.food, i.grams)));
export const dayTotals = (day: Day): Macros => sum(day.meals.map(mealTotals));
export const dayTarget = (d: DietDay): Macros => ({ kcal: d.target_kcal, protein: d.target_protein, carbs: d.target_carbs, fat: d.target_fat });

/** Día tipo que corresponde a una fecha (por día de la semana); si no hay, el primero. */
export function dayForWeekday<T extends { weekdays: number[] }>(days: T[], weekday: number): T | null {
  return days.find((d) => d.weekdays.includes(weekday)) ?? days[0] ?? null;
}

import type { FoodLog } from './types';

export const COMPLIED: Record<'si' | 'parcial' | 'no', { label: string; tag: string }> = {
  si: { label: 'Cumplí el plan', tag: 'green' },
  parcial: { label: 'Cumplí en parte', tag: 'amber' },
  no: { label: 'No cumplí', tag: 'red' },
};

export const logTotals = (logs: Pick<FoodLog, 'kcal' | 'protein' | 'carbs' | 'fat'>[]): Macros =>
  sum(logs.map((l) => ({ kcal: Number(l.kcal), protein: Number(l.protein), carbs: Number(l.carbs), fat: Number(l.fat) })));

/** Texto corto del desvío: "+350 kcal · −40 g proteína". */
export function deviationText(total: Macros, target: Macros) {
  const parts: string[] = [];
  const dk = Math.round(total.kcal - target.kcal);
  parts.push(`${dk > 0 ? '+' : dk < 0 ? '−' : ''}${Math.abs(dk).toLocaleString('es-AR')} kcal`);
  const dp = Math.round(total.protein - target.protein);
  if (Math.abs(dp) >= 10) parts.push(`${dp > 0 ? '+' : '−'}${Math.abs(dp)} g proteína`);
  const dc = Math.round(total.carbs - target.carbs);
  if (Math.abs(dc) >= 20) parts.push(`${dc > 0 ? '+' : '−'}${Math.abs(dc)} g carbos`);
  const df = Math.round(total.fat - target.fat);
  if (Math.abs(df) >= 10) parts.push(`${df > 0 ? '+' : '−'}${Math.abs(df)} g grasas`);
  return parts.join(' · ');
}

/** Desvío "significativo": más de 10 % en calorías. */
export const bigDeviation = (total: Macros, target: Macros) => target.kcal > 0 && Math.abs(total.kcal - target.kcal) > target.kcal * 0.1;

import { targets } from './nutrition';

/** Objetivo diario general del plan (calculado con el gasto y los g/kg); null si faltan datos. */
export function planTarget(p: Pick<FullDietPlan, 'tdee' | 'weight_kg' | 'adjust_pct' | 'protein_per_kg' | 'fat_per_kg'>): Macros | null {
  if (!p.tdee || !p.weight_kg) return null;
  return targets(Number(p.tdee), Number(p.adjust_pct), Number(p.weight_kg), Number(p.protein_per_kg), Number(p.fat_per_kg));
}

/** ¿El plan tiene comidas cargadas? (si no, es sólo un objetivo diario) */
export const hasMeals = (p: FullDietPlan) => p.days.some((d) => d.meals.some((m) => m.items.length));

/**
 * Objetivo de un día: el del día tipo que corresponde (si tiene objetivo cargado)
 * o, si no, el objetivo general del plan.
 */
export function targetForWeekday(p: FullDietPlan, weekday: number): { target: Macros | null; day: Day | null } {
  const day = dayForWeekday(p.days, weekday);
  if (day && day.target_kcal > 0) return { target: dayTarget(day), day };
  return { target: planTarget(p), day };
}
