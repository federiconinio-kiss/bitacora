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
