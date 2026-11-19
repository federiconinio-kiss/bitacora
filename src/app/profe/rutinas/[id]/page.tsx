import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getRoutine } from '@/lib/data';
import type { Exercise, Profile, RoutineReview, TrainingInfo } from '@/lib/types';
import RoutineBuilder from './RoutineBuilder';

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireUser('trainer');
  const routine = await getRoutine(sb, id);
  if (!routine) notFound();
  const [{ data: student }, { data: exercises }, { data: info }, { data: reviews }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', routine.student_id).single(),
    sb.from('exercises').select('*').order('name'),
    sb.from('student_training_info').select('*').eq('student_id', routine.student_id).maybeSingle(),
    sb.from('routine_reviews').select('*').eq('routine_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  return (
    <RoutineBuilder
      initial={routine}
      student={student as Profile}
      exercises={(exercises ?? []) as Exercise[]}
      trainingInfo={(info as TrainingInfo | null) ?? null}
      reviews={(reviews ?? []) as RoutineReview[]}
    />
  );
}
