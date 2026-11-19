import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getMe, getRoutine } from '@/lib/data';
import type { Measurement } from '@/lib/types';
import { buildPrompt, reviewRoutine, ReviewError, type Level, type Methodology } from '@/lib/ai/review';

// La revisión puede tardar 1–2 minutos.
export const maxDuration = 300;

const METHODS: Methodology[] = ['evidencia', 'piramide', 'heavy_duty', 'ambas'];

export async function POST(request: Request) {
  const sb = await supabaseServer();
  const me = await getMe(sb);
  if (!me || me.role !== 'trainer') return NextResponse.json({ error: 'Sólo el profe puede revisar rutinas.' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { routineId?: string; methodology?: string } | null;
  const methodology = METHODS.find((m) => m === body?.methodology);
  if (!body?.routineId || !methodology) return NextResponse.json({ error: 'Pedido incompleto.' }, { status: 400 });

  // RLS: sólo devuelve la rutina si es de un alumno de este profe.
  const routine = await getRoutine(sb, body.routineId);
  if (!routine) return NextResponse.json({ error: 'Rutina no encontrada.' }, { status: 404 });
  if (!routine.days.some((d) => d.exercises.length)) {
    return NextResponse.json({ error: 'Agregá al menos un ejercicio antes de pedir la revisión.' }, { status: 400 });
  }

  const [{ data: student }, { data: info }, { data: meas }] = await Promise.all([
    sb.from('profiles').select('age').eq('id', routine.student_id).single(),
    sb.from('student_training_info').select('level, notes').eq('student_id', routine.student_id).maybeSingle(),
    sb.from('measurements').select('*').eq('student_id', routine.student_id).order('measured_on', { ascending: false }).limit(1),
  ]);
  const level = (info?.level as Level | null) ?? null;

  const prompt = buildPrompt({
    routine,
    methodology,
    level,
    trainerNotes: info?.notes ?? '',
    age: student?.age ?? null,
    lastMeasurement: (meas?.[0] as Measurement | undefined) ?? null,
  });

  try {
    const result = await reviewRoutine(prompt);
    const { data: saved, error } = await sb
      .from('routine_reviews')
      .insert({ routine_id: routine.id, methodology, level, result })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: 'La revisión salió bien pero no se pudo guardar: ' + error.message }, { status: 500 });
    return NextResponse.json({ review: saved });
  } catch (e) {
    const msg = e instanceof ReviewError ? e.message : 'No se pudo completar la revisión. Probá de nuevo.';
    if (!(e instanceof ReviewError)) console.error('revisar-rutina', e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
