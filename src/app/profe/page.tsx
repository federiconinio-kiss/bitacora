import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import type { Profile, ProgressionRequest } from '@/lib/types';
import { daysBetween, fmtDate, todayISO } from '@/lib/utils';
import ProgressionInbox, { type InboxItem } from './ProgressionInbox';
import NutritionInbox, { type CheckinItem } from './NutritionInbox';
import type { DietCheckin } from '@/lib/types';

export default async function TrainerHome() {
  const { sb, me } = await requireUser('trainer');
  const [{ data: reqs }, { data: students }, { data: recentResolved }, { data: checkins }] = await Promise.all([
    sb.from('progression_requests').select('*').eq('status', 'pending').order('created_at'),
    sb.from('profiles').select('*').eq('trainer_id', me.id).eq('active', true).order('full_name'),
    sb.from('progression_requests').select('*').neq('status', 'pending').order('resolved_at', { ascending: false }).limit(8),
    sb.from('diet_checkins').select('*').is('trainer_seen_at', null).order('day', { ascending: false }).limit(40),
  ]);
  const pending = (reqs ?? []) as ProgressionRequest[];
  const resolved = (recentResolved ?? []) as ProgressionRequest[];
  const studs = (students ?? []) as Profile[];
  const byId = new Map(studs.map((s) => [s.id, s]));

  // Datos de cada ejercicio involucrado
  const rexIds = [...new Set([...pending, ...resolved].map((r) => r.routine_exercise_id))];
  const { data: rexs } = rexIds.length
    ? await sb.from('routine_exercises').select('id,sets,rep_min,rep_max,target_weight,exercise:exercises(name,muscle_group)').in('id', rexIds)
    : { data: [] };
  type RexInfo = { id: string; sets: number; rep_min: number; rep_max: number; target_weight: number | null; exercise: { name: string; muscle_group: string } };
  const rexMap = new Map(((rexs ?? []) as unknown as RexInfo[]).map((r) => [r.id, r]));

  // Última actividad por alumno
  const today = todayISO();
  const { data: lastLogs } = studs.length
    ? await sb.from('set_logs').select('student_id,performed_on').in('student_id', studs.map((s) => s.id)).gte('performed_on', new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)).order('performed_on', { ascending: false }).limit(3000)
    : { data: [] };
  const lastBy = new Map<string, string>();
  (lastLogs ?? []).forEach((l: { student_id: string; performed_on: string }) => { if (!lastBy.has(l.student_id)) lastBy.set(l.student_id, l.performed_on); });
  const inactive = studs.filter((s) => { const d = lastBy.get(s.id); return !d || daysBetween(d, today) >= 7; });

  const items: InboxItem[] = pending
    .filter((r) => rexMap.has(r.routine_exercise_id))
    .map((r) => {
      const x = rexMap.get(r.routine_exercise_id)!;
      const s = byId.get(r.student_id);
      return {
        id: r.id, studentId: r.student_id, studentName: s?.full_name || s?.email || 'Alumno', exercise: x.exercise.name, group: x.exercise.muscle_group,
        scheme: `${x.sets}×${x.rep_min}–${x.rep_max}`, weightAt: r.weight_at, repsAt: r.reps_at, target: x.target_weight, date: r.triggered_on,
      };
    });

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <div>
          <p className="type" style={{ margin: 0 }}>{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="h-hand">Avisos</h1>
        </div>
        <Link className="btn primary" href="/profe/alumnos?nuevo=1">+ Nuevo alumno</Link>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="stack">
          <h2 className="h-hand">Subidas de carga</h2>
          {items.length ? (
            <ProgressionInbox items={items} />
          ) : (
            <div className="sheet empty">
              <span className="tape" />
              <p className="ink">No hay subidas de carga pendientes.</p>
              <p className="muted small">Cuando un alumno complete todas las series en el tope del rango, te aparece acá para aprobar.</p>
            </div>
          )}
        </section>

        <aside className="stack-lg">
          <section className="sheet plain">
            <h2 className="h-hand" style={{ marginBottom: 8 }}>Nutrición: cierres del día</h2>
            <NutritionInbox items={((checkins ?? []) as DietCheckin[]).map((c): CheckinItem => ({ ...c, studentName: byId.get(c.student_id)?.full_name || byId.get(c.student_id)?.email || 'Alumno' }))} />
          </section>
          <section className="sheet plain">
            <h2 className="h-hand" style={{ marginBottom: 8 }}>Sin entrenar hace +7 días</h2>
            {inactive.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {inactive.map((s) => (
                  <li key={s.id} className="row between" style={{ borderBottom: '1px solid var(--rule)', minHeight: 44 }}>
                    <Link href={`/profe/alumnos/${s.id}`}>{s.full_name || s.email}</Link>
                    <span className="type">{lastBy.get(s.id) ? `último: ${fmtDate(lastBy.get(s.id)!)}` : 'sin registros'}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Todos tus alumnos entrenaron esta semana. 💪</p>}
          </section>

          <section className="sheet plain">
            <h2 className="h-hand" style={{ marginBottom: 8 }}>Resueltos recientemente</h2>
            {resolved.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {resolved.map((r) => {
                  const x = rexMap.get(r.routine_exercise_id);
                  const s = byId.get(r.student_id);
                  return (
                    <li key={r.id} style={{ borderBottom: '1px solid var(--rule)', padding: '6px 0' }}>
                      <span className={`tag ${r.status === 'approved' ? 'green' : 'red'}`}>{r.status === 'approved' ? `+${r.increment} kg` : 'mantiene'}</span>{' '}
                      <b>{s?.full_name || s?.email}</b> · {x?.exercise.name}
                      {r.status === 'approved' && <span className="type"> → {r.new_weight} kg</span>}
                      <span className="type muted"> {r.student_seen_at ? '· visto' : '· sin ver'}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">Nada todavía.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
