import type { SupabaseClient } from '@supabase/supabase-js';
import type { Exercise, FullRoutine } from './types';
import { NEW_EXERCISES, templateExerciseNames, type RoutineTemplate } from './templates';

type Day = FullRoutine['days'][number];

/**
 * Carga una plantilla de la guía en una rutina: crea los días (después de los que ya tenga),
 * los ejercicios con series, reps, pausa y nota, y sus reemplazos.
 * Crea en el catálogo los ejercicios de la guía que todavía no existan.
 */
export async function applyTemplate(sb: SupabaseClient, routine: FullRoutine, t: RoutineTemplate, catalog: Exercise[], withOptional: boolean) {
  const needed = templateExerciseNames(t, withOptional);
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
  let created: Exercise[] = [];

  const missing = needed.filter((n) => !byName.has(n.toLowerCase()));
  if (missing.length) {
    const toCreate = NEW_EXERCISES.filter((e) => missing.includes(e.name));
    if (toCreate.length) await sb.from('exercises').upsert(toCreate, { onConflict: 'name', ignoreDuplicates: true });
    const { data } = await sb.from('exercises').select('*').in('name', missing);
    created = (data ?? []) as Exercise[];
    created.forEach((e) => byName.set(e.name.toLowerCase(), e));
  }
  const find = (n: string) => byName.get(n.toLowerCase());
  const skipped = needed.filter((n) => !find(n));

  const days = t.days.filter((d) => withOptional || !d.optional);
  const base = routine.days.length;
  const { data: dayRows, error: e1 } = await sb.from('routine_days')
    .insert(days.map((d, i) => ({ routine_id: routine.id, title: d.title, day_of_week: d.dow, position: base + i })))
    .select('*');
  if (e1 || !dayRows) throw new Error(e1?.message ?? 'No se pudieron crear los días.');
  const dayByPos = new Map(dayRows.map((d) => [d.position as number, d]));

  const rexInput: Record<string, unknown>[] = [];
  days.forEach((d, i) => {
    const row = dayByPos.get(base + i)!;
    d.exercises.filter((e) => find(e.name)).forEach((e, k) => rexInput.push({
      day_id: row.id, exercise_id: find(e.name)!.id, position: k, sets: e.sets, rep_min: e.rep_min, rep_max: e.rep_max,
      rest_seconds: e.rest, notes: e.note,
    }));
  });
  const { data: rexRows, error: e2 } = await sb.from('routine_exercises').insert(rexInput).select('*');
  if (e2 || !rexRows) throw new Error(e2?.message ?? 'No se pudieron crear los ejercicios.');

  // Reemplazos
  const key = (dayId: string, pos: number) => `${dayId}:${pos}`;
  const rexByKey = new Map(rexRows.map((r) => [key(r.day_id, r.position), r]));
  const altInput: { routine_exercise_id: string; exercise_id: string }[] = [];
  const altsOf = new Map<string, Exercise[]>();
  days.forEach((d, i) => {
    const row = dayByPos.get(base + i)!;
    d.exercises.filter((e) => find(e.name)).forEach((e, k) => {
      const rex = rexByKey.get(key(row.id, k));
      if (!rex) return;
      const alts = e.alts.map(find).filter((a): a is Exercise => !!a && a.id !== rex.exercise_id);
      alts.forEach((a) => altInput.push({ routine_exercise_id: rex.id, exercise_id: a.id }));
      altsOf.set(rex.id, alts);
    });
  });
  if (altInput.length) {
    const { error: e3 } = await sb.from('routine_exercise_alternatives').insert(altInput);
    if (e3) throw new Error(e3.message);
  }

  // Nombre e indicaciones generales
  const fields: Partial<FullRoutine> = {};
  if (!routine.name.trim() || /^Rutina( \d+)?$/.test(routine.name.trim())) fields.name = t.name;
  const block = `${t.name}\n${t.progression}`;
  fields.notes = routine.notes.trim() ? `${routine.notes.trim()}\n\n${block}` : block;
  await sb.from('routines').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', routine.id);

  const newDays: Day[] = dayRows
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      ...d,
      exercises: rexRows.filter((r) => r.day_id === d.id).sort((a, b) => a.position - b.position)
        .map((r) => ({ ...r, exercise: [...byName.values()].find((e) => e.id === r.exercise_id)!, alternatives: altsOf.get(r.id) ?? [] })),
    }));
  return { days: newDays, fields, created, skipped };
}
