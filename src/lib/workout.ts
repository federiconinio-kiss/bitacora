'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FullRoutine, SetLog, WorkoutSession } from './types';
import { notify } from './notify';

type Day = FullRoutine['days'][number];

export const SKIP_REASONS = ['Máquina ocupada', 'Dolor o molestia', 'Sin tiempo', 'Cansancio', 'Otro'];

/** Una serie cuenta como hecha si tiene reps y peso cargados (el peso puede ser 0). */
export const setDone = (l: Pick<SetLog, 'reps' | 'weight' | 'skipped'> | undefined) =>
  !!l && !l.skipped && l.reps != null && l.weight != null;

/** Avance del día y detalle de lo salteado / sin cargar. */
export function dayProgress(day: Day, logs: Pick<SetLog, 'routine_exercise_id' | 'set_number' | 'reps' | 'weight' | 'skipped' | 'skip_reason'>[]) {
  let total = 0, done = 0, skipped = 0;
  const skippedList: { exercise: string; sets: number[]; reason: string | null }[] = [];
  const pendingList: { exercise: string; sets: number[] }[] = [];
  for (const e of day.exercises) {
    const sk: number[] = [], pe: number[] = [];
    let reason: string | null = null;
    for (let n = 1; n <= e.sets; n++) {
      total++;
      const l = logs.find((x) => x.routine_exercise_id === e.id && x.set_number === n);
      if (l?.skipped) { skipped++; sk.push(n); reason = reason ?? l.skip_reason ?? null; }
      else if (setDone(l)) done++;
      else pe.push(n);
    }
    if (sk.length) skippedList.push({ exercise: e.exercise.name, sets: sk, reason });
    if (pe.length) pendingList.push({ exercise: e.exercise.name, sets: pe });
  }
  return { total, done, skipped, pending: total - done - skipped, skippedList, pendingList, complete: total > 0 && done + skipped >= total };
}

// ---------- Entrenamiento en curso (para la barra en otras secciones) ----------
const KEY = 'ecf:active-workout:v1';
export type ActiveWorkout = { id: string; dayId: string; dayTitle: string; startedAt: string; total: number; done: number };
export function readActive(): ActiveWorkout | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function writeActive(a: ActiveWorkout | null) {
  try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch { /* */ }
  window.dispatchEvent(new Event('ecf:active-workout'));
}

export async function startSession(sb: SupabaseClient, input: { studentId: string; routineId: string; day: Day; date: string }) {
  const { data, error } = await sb.from('workout_sessions').upsert({
    student_id: input.studentId, routine_id: input.routineId, day_id: input.day.id, day_title: input.day.title,
    performed_on: input.date, started_at: new Date().toISOString(), ended_at: null, end_reason: null, reminder_sent_at: null,
  }, { onConflict: 'student_id,day_id,performed_on' }).select('*').single();
  if (error) throw error;
  return data as WorkoutSession;
}

/** Cierra la sesión con el resumen calculado a partir de lo guardado en la base. */
export async function finishSession(sb: SupabaseClient, session: WorkoutSession, day: Day, reason: 'completo' | 'manual' | 'olvidado', local?: ReturnType<typeof dayProgress>) {
  // Lo que ve el alumno en pantalla es lo más actual (puede haber series esperando señal).
  let p = local;
  if (!p) {
    const { data: logs } = await sb.from('set_logs').select('routine_exercise_id,set_number,reps,weight,skipped,skip_reason')
      .in('routine_exercise_id', day.exercises.map((e) => e.id)).eq('performed_on', session.performed_on);
    p = dayProgress(day, (logs ?? []) as SetLog[]);
  }
  const { data, error } = await sb.from('workout_sessions').update({
    ended_at: new Date().toISOString(), end_reason: reason,
    total_sets: p.total, done_sets: p.done, skipped_sets: p.skipped,
    summary: { skipped: p.skippedList, pending: p.pendingList },
  }).eq('id', session.id).select('*').single();
  if (error) throw error;
  writeActive(null);
  notify('session_finished', session.id);
  return { session: data as WorkoutSession, progress: p };
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
