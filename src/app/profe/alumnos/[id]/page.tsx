import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getRoutine } from '@/lib/data';
import type { FullRoutine, Measurement, Profile, SetLog, TrainingInfo } from '@/lib/types';
import StudentDetail from './StudentDetail';

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { sb, me } = await requireUser('trainer');
  const { data: student } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!student || (student as Profile).trainer_id !== me.id) notFound();

  const { data: rlist } = await sb.from('routines').select('id').eq('student_id', id).order('start_date', { ascending: false }).order('created_at', { ascending: false });
  const routines = (await Promise.all((rlist ?? []).map((r: { id: string }) => getRoutine(sb, r.id)))).filter(Boolean) as FullRoutine[];
  const [{ data: logs }, { data: meas }, { data: info }] = await Promise.all([
    sb.from('set_logs').select('*').eq('student_id', id).order('performed_on').limit(5000),
    sb.from('measurements').select('*').eq('student_id', id).order('measured_on'),
    sb.from('student_training_info').select('*').eq('student_id', id).maybeSingle(),
  ]);

  return (
    <StudentDetail
      student={student as Profile}
      routines={routines}
      logs={(logs ?? []) as SetLog[]}
      measurements={(meas ?? []) as Measurement[]}
      trainingInfo={(info as TrainingInfo | null) ?? null}
      initialTab={tab === 'historial' || tab === 'datos' ? tab : 'rutinas'}
    />
  );
}
