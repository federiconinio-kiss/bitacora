import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getActiveRoutine } from '@/lib/data';
import type { Measurement, ProgressionRequest, SetLog } from '@/lib/types';
import { DAYS, daysBetween, fmtDate, fmtKg, isoWeekday, todayISO, weekStart } from '@/lib/utils';
import ApprovedCelebration from './ApprovedCelebration';
import PushToggle from '@/components/PushToggle';

export default async function StudentHome() {
  const { sb, me } = await requireUser('student');
  const routine = await getActiveRoutine(sb, me.id);
  const today = todayISO();
  const monday = weekStart(today);

  const [{ data: reqs }, { data: meas }, { data: weekLogs }] = await Promise.all([
    sb.from('progression_requests').select('*').eq('student_id', me.id).order('created_at', { ascending: false }).limit(30),
    sb.from('measurements').select('*').eq('student_id', me.id).order('measured_on', { ascending: false }).limit(1),
    sb.from('set_logs').select('routine_exercise_id,performed_on').eq('student_id', me.id).gte('performed_on', monday),
  ]);
  const requests = (reqs ?? []) as ProgressionRequest[];
  const lastMeas = (meas?.[0] as Measurement | undefined) ?? null;
  const logs = (weekLogs ?? []) as Pick<SetLog, 'routine_exercise_id' | 'performed_on'>[];

  const exName = new Map<string, string>();
  routine?.days.forEach((d) => d.exercises.forEach((e) => exName.set(e.id, e.exercise.name)));
  const pending = requests.filter((r) => r.status === 'pending' && exName.has(r.routine_exercise_id));
  const unseen = requests.filter((r) => r.status !== 'pending' && !r.student_seen_at && exName.has(r.routine_exercise_id));
  const measDue = !lastMeas || daysBetween(lastMeas.measured_on, today) >= 14;
  const wd = isoWeekday(today);
  const firstName = (me.full_name || '').split(' ')[0];

  if (!routine)
    return (
      <div className="stack-lg">
        <h1 className="h-hand">¡Hola{firstName ? `, ${firstName}` : ''}!</h1>
        <div className="sheet empty">
          <span className="tape" />
          <p className="ink">Tu profe todavía está armando tu rutina.</p>
          <p className="muted">Cuando la publique la vas a ver acá.</p>
        </div>
        <Link href="/alumno/perfil" className="btn">Completar mis datos</Link>
      </div>
    );

  return (
    <div className="stack-lg">
      <ApprovedCelebration
        items={unseen.map((r) => ({ id: r.id, status: r.status, name: exName.get(r.routine_exercise_id)!, newWeight: r.new_weight, increment: r.increment, note: r.trainer_note }))}
      />
      <div>
        <p className="type" style={{ margin: 0 }}>{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="h-hand">¡Hola{firstName ? `, ${firstName}` : ''}!</h1>
      </div>

      <PushToggle compact />

      <section className="sheet tilt-l">
        <span className="tape" />
        <p className="type" style={{ margin: 0 }}>{routine.name} · desde {fmtDate(routine.start_date)}</p>
        <h2 className="h-hand" style={{ margin: '6px 0' }}>Objetivo</h2>
        <p className="ink" style={{ fontSize: '1.6rem', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.2 }}>{routine.goal || '—'}</p>
        {routine.notes && <p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{routine.notes}</p>}
      </section>

      {pending.length > 0 && (
        <div className="postit" role="status">
          <b>Esperando a tu profe:</b> llegaste al tope del rango en {pending.map((p) => exName.get(p.routine_exercise_id)).join(', ')}. Te avisamos cuando apruebe la subida de carga.
        </div>
      )}
      {measDue && (
        <Link href="/alumno/perfil#medir" className="notice amber" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          📏 {lastMeas ? `Pasaron ${daysBetween(lastMeas.measured_on, today)} días desde tu última medición.` : 'Todavía no cargaste tus medidas.'} <u>Cargar medidas</u>
        </Link>
      )}

      <div className="stack-lg" style={{ marginTop: 8 }}>
        {routine.days.map((d) => {
          const ids = new Set(d.exercises.map((e) => e.id));
          const doneDates = new Set(logs.filter((l) => ids.has(l.routine_exercise_id)).map((l) => l.performed_on));
          const isToday = d.day_of_week === wd;
          const exDoneToday = new Set(logs.filter((l) => ids.has(l.routine_exercise_id) && l.performed_on === today).map((l) => l.routine_exercise_id));
          return (
            <Link key={d.id} href={`/alumno/dia/${d.id}`} className={`day-card ${isToday ? 'today' : ''}`}>
              <span className="day-tab">{d.day_of_week ? DAYS[d.day_of_week - 1] : 'Libre'}{isToday && ' · hoy'}</span>
              <div className="sheet">
                <div className="row between">
                  <h2 className="h-hand">{d.title}</h2>
                  {doneDates.size > 0 && <span className="stamp green" style={{ fontSize: '.8rem' }}>Hecho</span>}
                </div>
                <ol style={{ margin: '8px 0 0', paddingLeft: 22 }}>
                  {d.exercises.map((e) => (
                    <li key={e.id} style={{ lineHeight: '32px' }}>
                      {e.exercise.name} <span className="type" style={{ whiteSpace: 'nowrap' }}>{e.sets}×{e.rep_min}–{e.rep_max}{e.target_weight != null ? ` · ${fmtKg(e.target_weight)}` : ' · carga a elegir'}</span>
                    </li>
                  ))}
                </ol>
                {isToday && d.exercises.length > 0 && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <div className="progress-dots" aria-label={`${exDoneToday.size} de ${d.exercises.length} ejercicios cargados hoy`}>
                      {d.exercises.map((e) => <i key={e.id} className={exDoneToday.has(e.id) ? 'on' : ''} />)}
                    </div>
                    <span className="note-hand">{exDoneToday.size ? '¡Seguí así!' : '¡A entrenar!'} →</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
