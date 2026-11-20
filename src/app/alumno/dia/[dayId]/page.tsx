import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getActiveRoutine } from '@/lib/data';
import type { ProgressionRequest, SetLog, WorkoutSession } from '@/lib/types';
import { DAYS, todayISO } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import WorkoutSheet from './WorkoutSheet';

export default async function DayPage({ params, searchParams }: { params: Promise<{ dayId: string }>; searchParams: Promise<{ fecha?: string }> }) {
  const { dayId } = await params;
  const { fecha } = await searchParams;
  const { sb, me } = await requireUser('student');
  const routine = await getActiveRoutine(sb, me.id);
  const day = routine?.days.find((d) => d.id === dayId);
  if (!routine || !day) notFound();

  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayISO();
  const ids = day.exercises.map((e) => e.id);
  const [{ data: logs }, { data: reqs }, { data: wsession }] = await Promise.all([
    ids.length
      ? sb.from('set_logs').select('*').in('routine_exercise_id', ids).lte('performed_on', date).order('performed_on', { ascending: false }).limit(600)
      : Promise.resolve({ data: [] }),
    ids.length
      ? sb.from('progression_requests').select('*').in('routine_exercise_id', ids).eq('status', 'pending')
      : Promise.resolve({ data: [] }),
    sb.from('workout_sessions').select('*').eq('student_id', me.id).eq('day_id', day.id).eq('performed_on', date).maybeSingle(),
  ]);
  const all = (logs ?? []) as SetLog[];
  const current = all.filter((l) => l.performed_on === date);
  // Última sesión previa de cada ejercicio, como referencia en lápiz.
  const previous: Record<string, SetLog[]> = {};
  for (const id of ids) {
    const prevDate = all.find((l) => l.routine_exercise_id === id && l.performed_on < date)?.performed_on;
    previous[id] = prevDate ? all.filter((l) => l.routine_exercise_id === id && l.performed_on === prevDate) : [];
  }

  return (
    <div className="stack-lg">
      <div className="row">
        <Link href="/alumno" className="icon-btn" aria-label="Volver"><IconBack /></Link>
        <div className="grow">
          <p className="type" style={{ margin: 0 }}>{day.day_of_week ? DAYS[day.day_of_week - 1] : 'Día libre'}</p>
          <h1 className="h-hand">{day.title}</h1>
        </div>
      </div>
      <WorkoutSheet
        key={date}
        studentId={me.id}
        routineId={routine.id}
        initialSession={(wsession as WorkoutSession | null) ?? null}
        date={date}
        day={day}
        initial={current}
        previous={previous}
        pendingIds={((reqs ?? []) as ProgressionRequest[]).map((r) => r.routine_exercise_id)}
      />
    </div>
  );
}
