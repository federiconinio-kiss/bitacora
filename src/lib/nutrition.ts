// Cálculos de nutrición: gasto calórico, objetivo y macros. Funciones puras (sirven en cliente y servidor).

export type Sex = 'M' | 'F';
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';
export type Method = 'mifflin' | 'katch' | 'cunningham';
export type GoalType = 'baja_grasa' | 'recomposicion' | 'mantenimiento' | 'aumento';

export const ACTIVITIES: { key: Activity; label: string; factor: number; hint: string }[] = [
  { key: 'sedentario', label: 'Sedentario', factor: 1.2, hint: 'trabajo sentado, poco o nada de ejercicio' },
  { key: 'ligero', label: 'Ligero', factor: 1.375, hint: 'entrena 1–3 días por semana' },
  { key: 'moderado', label: 'Moderado', factor: 1.55, hint: 'entrena 3–5 días por semana' },
  { key: 'activo', label: 'Activo', factor: 1.725, hint: 'entrena 6–7 días o trabajo físico' },
  { key: 'muy_activo', label: 'Muy activo', factor: 1.9, hint: 'doble turno o trabajo muy físico + entrenamiento' },
];

export const METHODS: { key: Method; label: string; needs: string; hint: string }[] = [
  { key: 'mifflin', label: 'Mifflin-St Jeor', needs: 'peso, altura, edad y sexo', hint: 'El estándar recomendado para la población general.' },
  { key: 'katch', label: 'Katch-McArdle', needs: 'peso y % de grasa', hint: 'Usa la masa magra: más preciso si entrena fuerza y conocés su composición corporal.' },
  { key: 'cunningham', label: 'Cunningham', needs: 'peso y % de grasa', hint: 'Variante basada en masa magra, algo más alta: suele usarse en personas muy activas.' },
];

export const GOALS: { key: GoalType; label: string; adjust: number; range: string; protein: number; fat: number; text: string }[] = [
  { key: 'baja_grasa', label: 'Baja de grasa', adjust: -20, range: '−15 a −25 %', protein: 2.2, fat: 0.7,
    text: 'Comer un poco menos de lo que gastás para perder grasa, con proteína alta para cuidar el músculo y el rendimiento en el gimnasio.' },
  { key: 'recomposicion', label: 'Recomposición', adjust: -7, range: '−5 a −10 %', protein: 2.2, fat: 0.8,
    text: 'Un déficit chico para bajar grasa de a poco mientras seguís ganando músculo con el entrenamiento. La proteína alta es la clave.' },
  { key: 'mantenimiento', label: 'Mantenimiento', adjust: 0, range: '0 %', protein: 1.8, fat: 0.8,
    text: 'Comer lo mismo que gastás para mantener el peso y rendir bien en los entrenamientos.' },
  { key: 'aumento', label: 'Aumento de masa', adjust: 10, range: '+5 a +15 %', protein: 1.8, fat: 0.9,
    text: 'Comer un poco más de lo que gastás para tener la energía necesaria para construir músculo, minimizando la ganancia de grasa.' },
];

export function activityFactor(a: Activity | null | undefined) {
  return ACTIVITIES.find((x) => x.key === a)?.factor ?? 1.2;
}

/** Metabolismo basal (kcal/día) según cada método. Devuelve null si faltan datos. */
export function bmrAll(input: { weight: number | null; height: number | null; age: number | null; sex: Sex | null; bodyFat: number | null }) {
  const { weight: w, height: h, age: a, sex: s, bodyFat: bf } = input;
  const lbm = w != null && bf != null ? w * (1 - bf / 100) : null;
  return {
    mifflin: w != null && h != null && a != null && s ? Math.round(10 * w + 6.25 * h - 5 * a + (s === 'M' ? 5 : -161)) : null,
    katch: lbm != null ? Math.round(370 + 21.6 * lbm) : null,
    cunningham: lbm != null ? Math.round(500 + 22 * lbm) : null,
    lbm: lbm != null ? Math.round(lbm * 10) / 10 : null,
  };
}

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

/** Objetivo diario: kcal ajustadas y macros (proteína y grasa por kg, carbohidratos el resto). */
export function targets(tdee: number, adjustPct: number, weight: number, proteinPerKg: number, fatPerKg: number): Macros {
  const kcal = Math.round((tdee * (1 + adjustPct / 100)) / 10) * 10;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round(weight * fatPerKg);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

/** Avisos de seguridad sobre el objetivo calórico. */
export function safetyWarnings(t: Macros, bmr: number | null, sex: Sex | null) {
  const w: string[] = [];
  const floor = sex === 'F' ? 1200 : 1500;
  if (t.kcal < floor) w.push(`El objetivo (${t.kcal} kcal) está por debajo de ${floor} kcal, un mínimo razonable sin supervisión de un profesional de la salud.`);
  else if (bmr != null && t.kcal < bmr) w.push(`El objetivo (${t.kcal} kcal) queda por debajo del metabolismo basal (${bmr} kcal). Conviene un déficit más moderado.`);
  if (t.carbs * 4 + t.protein * 4 + t.fat * 9 > t.kcal + 20) w.push('La proteína y la grasa ya superan las calorías del objetivo: bajá los g/kg o subí las calorías.');
  else if (t.carbs < 50) w.push('Quedan menos de 50 g de carbohidratos por día: puede afectar el rendimiento en los entrenamientos.');
  return w;
}

/** Macros de una porción a partir de los valores cada 100 g. */
export function portion(food: { kcal: number; protein: number; carbs: number; fat: number }, grams: number): Macros {
  const f = grams / 100;
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f };
}

export function sum(list: Macros[]): Macros {
  return list.reduce((a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
