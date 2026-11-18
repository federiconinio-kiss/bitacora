import type { SupabaseClient } from '@supabase/supabase-js';
import type { FullRoutine } from './types';
import { todayISO } from './utils';

/** Copia una rutina completa (días, ejercicios y opciones) como borrador nuevo. */
export async function duplicateRoutine(sb: SupabaseClient, r: FullRoutine, studentId = r.student_id) {
  const { data: nr, error } = await sb
    .from('routines')
    .insert({ student_id: studentId, name: `${r.name} (copia)`, goal: r.goal, notes: r.notes, start_date: todayISO(), published: false })
    .select('id').single();
  if (error) throw error;
  for (const d of r.days) {
    const { data: nd, error: e1 } = await sb.from('routine_days').insert({ routine_id: nr.id, title: d.title, day_of_week: d.day_of_week, position: d.position }).select('id').single();
    if (e1) throw e1;
    for (const e of d.exercises) {
      const { data: ne, error: e2 } = await sb.from('routine_exercises').insert({
        day_id: nd.id, exercise_id: e.exercise_id, position: e.position, sets: e.sets, rep_min: e.rep_min, rep_max: e.rep_max,
        target_weight: e.target_weight, target_source: e.target_source, rest_seconds: e.rest_seconds, notes: e.notes,
      }).select('id').single();
      if (e2) throw e2;
      if (e.alternatives.length) {
        const { error: e3 } = await sb.from('routine_exercise_alternatives').insert(e.alternatives.map((a) => ({ routine_exercise_id: ne.id, exercise_id: a.id })));
        if (e3) throw e3;
      }
    }
  }
  return nr.id as string;
}
