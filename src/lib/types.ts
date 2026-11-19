export type Role = 'trainer' | 'student';

export interface Profile {
  id: string;
  role: Role;
  email: string;
  full_name: string;
  age: number | null;
  phone: string | null;
  trainer_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  video_url: string | null;
  cues: string | null;
}

export interface Routine {
  id: string;
  student_id: string;
  trainer_id: string;
  name: string;
  goal: string;
  notes: string;
  published: boolean;
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineDay {
  id: string;
  routine_id: string;
  title: string;
  day_of_week: number | null;
  position: number;
}

export interface RoutineExercise {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  target_weight: number | null;
  /** Quién definió la carga: el profe al armar la rutina o el alumno en su primera sesión. */
  target_source: 'trainer' | 'student';
  target_set_on: string | null;
  rest_seconds: number | null;
  notes: string;
}

export interface Alternative {
  id: string;
  routine_exercise_id: string;
  exercise_id: string;
}

export interface SetLog {
  id: string;
  student_id: string;
  routine_exercise_id: string;
  exercise_id: string;
  performed_on: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
}

export interface Measurement {
  id: string;
  student_id: string;
  measured_on: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  arm: number | null;
  thigh: number | null;
  body_fat: number | null;
  notes: string;
}

export interface ProgressionRequest {
  id: string;
  student_id: string;
  routine_exercise_id: string;
  triggered_on: string;
  weight_at: number | null;
  reps_at: number | null;
  status: 'pending' | 'approved' | 'rejected';
  increment: number | null;
  new_weight: number | null;
  trainer_note: string;
  resolved_at: string | null;
  student_seen_at: string | null;
  created_at: string;
}

/** Rutina completa, tal como la usan las pantallas. */
export interface FullRoutine extends Routine {
  days: (RoutineDay & {
    exercises: (RoutineExercise & { exercise: Exercise; alternatives: Exercise[] })[];
  })[];
}

export const MEASURE_FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'chest', label: 'Pecho', unit: 'cm' },
  { key: 'hips', label: 'Cadera', unit: 'cm' },
  { key: 'arm', label: 'Brazo', unit: 'cm' },
  { key: 'thigh', label: 'Muslo', unit: 'cm' },
  { key: 'body_fat', label: '% grasa', unit: '%' },
];

export type Level = 'principiante' | 'intermedio' | 'avanzado';
export const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: 'principiante', label: 'Principiante', hint: 'menos de ~1 año entrenando' },
  { key: 'intermedio', label: 'Intermedio', hint: '~1 a 3 años' },
  { key: 'avanzado', label: 'Avanzado', hint: 'más de 3 años, cerca de su potencial' },
];

/** Ficha privada del profe sobre el alumno (el alumno no la ve). */
export interface TrainingInfo {
  student_id: string;
  level: Level | null;
  notes: string;
  sex: 'M' | 'F' | null;
  height_cm: number | null;
  activity: import('./nutrition').Activity | null;
  updated_at: string;
}

export interface RoutineReview {
  id: string;
  routine_id: string;
  methodology: 'piramide' | 'heavy_duty' | 'ambas';
  level: Level | null;
  result: import('./ai/review-types').Review;
  created_at: string;
}

// ------------------------------- Nutrición -------------------------------
export interface Food {
  id: string;
  name: string;
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  unit_name: string | null;
  unit_grams: number | null;
}

export interface DietPlan {
  id: string;
  student_id: string;
  trainer_id: string;
  name: string;
  goal_type: import('./nutrition').GoalType;
  explanation: string;
  method: import('./nutrition').Method;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: import('./nutrition').Sex | null;
  body_fat: number | null;
  activity: import('./nutrition').Activity | null;
  bmr: number | null;
  tdee: number | null;
  adjust_pct: number;
  protein_per_kg: number;
  fat_per_kg: number;
  published: boolean;
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface DietDay {
  id: string;
  plan_id: string;
  title: string;
  weekdays: number[];
  position: number;
  target_kcal: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
}
export interface DietMeal { id: string; day_id: string; title: string; time_hint: string | null; notes: string; position: number }
export interface DietItem { id: string; meal_id: string; food_id: string; grams: number; position: number }

export interface FullDietPlan extends DietPlan {
  days: (DietDay & { meals: (DietMeal & { items: (DietItem & { food: Food })[] })[] })[];
}

export interface FoodLog {
  id: string;
  student_id: string;
  logged_on: string;
  logged_at: string | null;
  meal_label: string | null;
  plan_meal_id: string | null;
  food_id: string | null;
  grams: number | null;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

export interface DietCheckin {
  id: string;
  student_id: string;
  day: string;
  plan_id: string | null;
  complied: 'si' | 'parcial' | 'no';
  comment: string;
  target_kcal: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  total_kcal: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  trainer_seen_at: string | null;
  created_at: string;
  updated_at: string;
}
