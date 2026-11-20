import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/push';

/**
 * La llama la tarea programada de la base (pg_cron) cuando un entrenamiento lleva
 * más de 1,5 h sin finalizar. Se verifica con el secreto guardado en app_config.
 */
export async function POST(request: Request) {
  const admin = supabaseAdmin();
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  if (!cfg?.value || request.headers.get('x-cron-secret') !== cfg.value) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { session_id } = (await request.json().catch(() => ({}))) as { session_id?: string };
  if (!session_id) return NextResponse.json({ error: 'Falta session_id.' }, { status: 400 });
  const { data: w } = await admin.from('workout_sessions').select('id, student_id, day_id, day_title, ended_at, started_at').eq('id', session_id).maybeSingle();
  if (!w || w.ended_at) return NextResponse.json({ ok: true, sent: 0 });
  const mins = Math.round((Date.now() - new Date(w.started_at).getTime()) / 60000);
  const r = await sendPush(w.student_id, {
    title: '¿Seguís entrenando? ⏱',
    body: `Empezaste ${w.day_title || 'tu entrenamiento'} hace ${Math.floor(mins / 60)} h ${mins % 60} min y todavía no lo finalizaste. Si ya terminaste, cerralo desde la app.`,
    url: w.day_id ? `/alumno/dia/${w.day_id}` : '/alumno',
    tag: `stale-${w.id}`,
  });
  return NextResponse.json({ ok: true, ...r });
}
