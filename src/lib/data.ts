import type { SupabaseClient } from '@supabase/supabase-js';
import type { Exercise, FullRoutine, Profile } from './types';

const ROUTINE_SELECT = `*,
  days:routine_days(*,
    exercises:routine_exercises(*,
      exercise:exercises(*),
      alternatives:routine_exercise_alternatives(exercise:exercises(*))
    )
  )`;

type RawRex = Omit<FullRoutine['days'][number]['exercises'][number], 'alternatives'> & { alternatives: { exercise: Exercise }[] };
type RawDay = Omit<FullRoutine['days'][number], 'exercises'> & { exercises: RawRex[] };
type RawRoutine = Omit<FullRoutine, 'days'> & { days: RawDay[] };

function normalize(r: RawRoutine): FullRoutine {
  return {
    ...r,
    days: [...r.days]
      .sort((a, b) => (a.day_of_week ?? 9) - (b.day_of_week ?? 9) || a.position - b.position)
      .map((d) => ({
        ...d,
        exercises: [...d.exercises]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ ...e, alternatives: e.alternatives.map((a) => a.exercise).filter(Boolean) })),
      })),
  };
}

export async function getRoutine(sb: SupabaseClient, id: string): Promise<FullRoutine | null> {
  const { data } = await sb.from('routines').select(ROUTINE_SELECT).eq('id', id).maybeSingle();
  return data ? normalize(data as RawRoutine) : null;
}

/** La rutina publicada más reciente del alumno. */
export async function getActiveRoutine(sb: SupabaseClient, studentId: string): Promise<FullRoutine | null> {
  const { data } = await sb
    .from('routines')
    .select(ROUTINE_SELECT)
    .eq('student_id', studentId)
    .eq('published', true)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? normalize(data as RawRoutine) : null;
}

export async function getMe(sb: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
}
