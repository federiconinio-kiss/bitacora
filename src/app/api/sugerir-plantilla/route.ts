import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getMe, getRoutine } from '@/lib/data';
import { AiError } from '@/lib/ai/claude';
import { suggestTemplate } from '@/lib/ai/suggest';
import { TEMPLATES } from '@/lib/templates';

export const maxDuration = 300;

const WEEKS = 12;
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const weekIndex = (d: string) => Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / (7 * 864e5)); // 0 = esta semana
const epley = (w: number, r: number) => w * (1 + r / 30);

export async function POST(request: Request) {
  const sb = await supabaseServer();
  const me = await getMe(sb);
  if (!me || me.role !== 'trainer') return NextResponse.json({ error: 'Sólo el profe puede pedir sugerencias.' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { routineId?: string; days?: number | null; situation?: string } | null;
  if (!body?.routineId) return NextResponse.json({ error: 'Pedido incompleto.' }, { status: 400 });
  const routine = await getRoutine(sb, body.routineId);
  if (!routine) return NextResponse.json({ error: 'Rutina no encontrada.' }, { status: 404 });
  const sid = routine.student_id;
  const since = isoDaysAgo(WEEKS * 7);

  const [{ data: student }, { data: info }, { data: routines }, { data: sessions }, { data: logs }, { data: reqs }] = await Promise.all([
    sb.from('profiles').select('age').eq('id', sid).single(),
    sb.from('student_training_info').select('level, notes, sex').eq('student_id', sid).maybeSingle(),
    sb.from('routines').select('id, name, goal, start_date, published, routine_days(id, routine_exercises(id))').eq('student_id', sid).order('start_date', { ascending: false }).limit(10),
    sb.from('workout_sessions').select('performed_on, done_sets, total_sets, skipped_sets, end_reason').eq('student_id', sid).gte('performed_on', since),
    sb.from('set_logs').select('performed_on, reps, weight, exercise:exercises(name)').eq('student_id', sid).gte('performed_on', since).not('weight', 'is', null).limit(5000),
    sb.from('progression_requests').select('status, triggered_on').eq('student_id', sid).gte('triggered_on', since),
  ]);

  type R = { id: string; name: string; goal: string; start_date: string; published: boolean; routine_days: { id: string; routine_exercises: { id: string }[] }[] };
  const rs = (routines ?? []) as unknown as R[];
  const active = rs.find((r) => r.published) ?? null;
  const trainingDays = (r: R) => r.routine_days.filter((d) => d.routine_exercises.length).length;
  const tplName = (name: string) => TEMPLATES.find((t) => t.name === name)?.id;

  // Historial de rutinas
  const history = rs.map((r) => {
    const weeks = Math.max(0, weekIndex(r.start_date));
    return `- ${r.start_date}: "${r.name}"${tplName(r.name) ? ` (plantilla ${tplName(r.name)})` : ''}, ${trainingDays(r)} días${r.published ? `, VIGENTE hace ${weeks} semanas` : ''}`;
  }).join('\n');

  // Adherencia de las últimas 8 semanas (o desde que arrancó la rutina vigente)
  const planned = active ? trainingDays(active) : null;
  const ss = (sessions ?? []) as { performed_on: string; done_sets: number; total_sets: number; skipped_sets: number; end_reason: string | null }[];
  const weeksActive = active ? Math.min(8, Math.max(1, weekIndex(active.start_date) + 1)) : 8;
  const recent = ss.filter((s) => weekIndex(s.performed_on) < weeksActive);
  const perWeek = Array.from({ length: weeksActive }, (_, w) => recent.filter((s) => weekIndex(s.performed_on) === w).length).reverse();
  const adherence = planned ? Math.round((recent.length / (planned * weeksActive)) * 100) : null;
  const doneSets = recent.reduce((n, s) => n + s.done_sets, 0), totalSets = recent.reduce((n, s) => n + s.total_sets, 0);
  const skipped = recent.reduce((n, s) => n + s.skipped_sets, 0);

  // Progreso: mejor 1RM estimado por semana, primeras vs últimas semanas con datos
  type L = { performed_on: string; reps: number | null; weight: number | null; exercise: { name: string } | null };
  const byEx = new Map<string, Map<number, number>>();
  for (const l of (logs ?? []) as unknown as L[]) {
    if (!l.exercise || !l.weight || !l.reps) continue;
    const w = weekIndex(l.performed_on);
    const m = byEx.get(l.exercise.name) ?? new Map<number, number>();
    m.set(w, Math.max(m.get(w) ?? 0, epley(Number(l.weight), l.reps)));
    byEx.set(l.exercise.name, m);
  }
  const progress = [...byEx.entries()]
    .filter(([, m]) => m.size >= 3)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 12)
    .map(([name, m]) => {
      const weeks = [...m.keys()].sort((a, b) => b - a); // de la más vieja a la más nueva
      const k = Math.min(2, Math.floor(weeks.length / 2));
      const avg = (ws: number[]) => ws.reduce((s, w) => s + m.get(w)!, 0) / ws.length;
      const first = avg(weeks.slice(0, k)), last = avg(weeks.slice(-k));
      const pct = ((last - first) / first) * 100;
      const best = Math.max(...m.values());
      const lastBestWeek = weeks.find((w) => m.get(w) === best)!;
      return `- ${name}: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% de 1RM estimado en ${weeks.length} semanas con registro; último récord hace ${lastBestWeek} semanas`;
    }).join('\n');

  const reqList = (reqs ?? []) as { status: string; triggered_on: string }[];
  const approved = reqList.filter((r) => r.status === 'approved').length;
  const last4 = reqList.filter((r) => weekIndex(r.triggered_on) < 4).length;

  const prompt = `ALUMNO
- Nivel cargado: ${info?.level ?? 'no indicado'}
- Edad: ${student?.age ?? 'no indicada'} · Sexo: ${info?.sex === 'F' ? 'mujer' : info?.sex === 'M' ? 'hombre' : 'no indicado'}
- Notas privadas del profe (lesiones, preferencias): ${info?.notes?.trim() || 'ninguna'}
- Objetivo: ${routine.goal.trim() || active?.goal.trim() || 'no indicado'}
- Días por semana que puede entrenar: ${body.days ?? (planned ? `sin dato (la rutina vigente tiene ${planned})` : 'sin dato')}
- Situación actual según Fede: ${body.situation?.trim() || 'sin comentarios'}

RUTINAS (de la más nueva a la más vieja)
${history || '- Ninguna todavía.'}

ADHERENCIA (últimas ${weeksActive} semanas${active ? ' de la rutina vigente' : ''})
${planned ? `- ${recent.length} sesiones de ${planned * weeksActive} planificadas (${adherence}%). Por semana, de la más vieja a esta: ${perWeek.join(', ')}` : '- Sin rutina vigente.'}
- Series hechas ${doneSets} de ${totalSets}, ${skipped} salteadas.

PROGRESO (últimas ${WEEKS} semanas, ejercicios con más registro)
${progress || '- Sin datos suficientes de cargas.'}
- Subidas de carga por progresión doble: ${reqList.length} pedidas (${approved} aprobadas), ${last4} en las últimas 4 semanas.`;

  try {
    const suggestion = await suggestTemplate(prompt);
    return NextResponse.json({ suggestion });
  } catch (e) {
    const msg = e instanceof AiError ? e.message : 'No se pudo completar la sugerencia. Probá de nuevo.';
    if (!(e instanceof AiError)) console.error('sugerir-plantilla', e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
