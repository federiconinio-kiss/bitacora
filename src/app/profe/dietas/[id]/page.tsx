import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getActiveRoutine, getDietPlan, numFood } from '@/lib/data';
import type { Food, Measurement, Profile, TrainingInfo } from '@/lib/types';
import DietBuilder from './DietBuilder';

export default async function DietPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireUser('trainer');
  const plan = await getDietPlan(sb, id);
  if (!plan) notFound();
  const [{ data: student }, { data: foods }, { data: info }, { data: meas }, routine] = await Promise.all([
    sb.from('profiles').select('*').eq('id', plan.student_id).single(),
    sb.from('foods').select('*').order('name'),
    sb.from('student_training_info').select('*').eq('student_id', plan.student_id).maybeSingle(),
    sb.from('measurements').select('*').eq('student_id', plan.student_id).order('measured_on', { ascending: false }).limit(1),
    getActiveRoutine(sb, plan.student_id),
  ]);
  // Días de la semana en que entrena, según su rutina publicada
  const trainingWeekdays = [...new Set((routine?.days ?? []).map((d) => d.day_of_week).filter((d): d is number => d != null))].sort();
  return (
    <DietBuilder
      initial={plan}
      student={student as Profile}
      foods={((foods ?? []) as Food[]).map(numFood)}
      info={(info as TrainingInfo | null) ?? null}
      lastMeasurement={(meas?.[0] as Measurement | undefined) ?? null}
      trainingWeekdays={trainingWeekdays}
    />
  );
}
