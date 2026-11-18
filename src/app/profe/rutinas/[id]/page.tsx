import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getRoutine } from '@/lib/data';
import type { Exercise, Profile } from '@/lib/types';
import RoutineBuilder from './RoutineBuilder';

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireUser('trainer');
  const routine = await getRoutine(sb, id);
  if (!routine) notFound();
  const [{ data: student }, { data: exercises }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', routine.student_id).single(),
    sb.from('exercises').select('*').order('name'),
  ]);
  return <RoutineBuilder initial={routine} student={student as Profile} exercises={(exercises ?? []) as Exercise[]} />;
}
