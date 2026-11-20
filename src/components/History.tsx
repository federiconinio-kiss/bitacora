'use client';
import { Fragment, useMemo, useState } from 'react';
import type { FullRoutine, Measurement, SetLog } from '@/lib/types';
import { MEASURE_FIELDS } from '@/lib/types';
import { DAYS, fmtDate, weekStart } from '@/lib/utils';
import LineChart, { type Point } from './LineChart';

type Metric = 'peso' | 'volumen' | 'reps' | 'e1rm';
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'peso', label: 'Peso máximo', unit: 'kg' },
  { key: 'volumen', label: 'Volumen', unit: 'kg' },
  { key: 'reps', label: 'Repeticiones', unit: 'reps' },
  { key: 'e1rm', label: '1RM estimado', unit: 'kg' },
];

const kg = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
/** Serie como par peso × reps: "100 × 12". */
export const setText = (w: number | null | undefined, r: number | null | undefined) =>
  `${w != null ? kg(Number(w)) : '–'} × ${r ?? '–'}`;

/** 1RM estimado con la fórmula de Epley: peso × (1 + reps / 30). */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

const done = (l: SetLog) => l.reps != null && l.reps > 0;

/** Mejor serie del grupo: la de mayor 1RM estimado (empate: más peso). */
function bestSet(ls: SetLog[]) {
  return ls.filter(done).reduce<SetLog | null>((b, l) => {
    if (!b) return l;
    const a = e1rm(Number(l.weight ?? 0), l.reps!), c = e1rm(Number(b.weight ?? 0), b.reps!);
    return a > c || (a === c && Number(l.weight ?? 0) > Number(b.weight ?? 0)) ? l : b;
  }, null);
}

/** Serie semanal por ejercicio. */
function weekly(logs: SetLog[], metric: Metric): Point[] {
  const byWeek = new Map<string, SetLog[]>();
  logs.filter(done).forEach((l) => {
    const w = weekStart(l.performed_on);
    byWeek.set(w, [...(byWeek.get(w) ?? []), l]);
  });
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, ls]) => {
      const maxW = Math.max(...ls.map((l) => Number(l.weight ?? 0)));
      const topReps = Math.max(...ls.filter((l) => Number(l.weight ?? 0) === maxW).map((l) => l.reps ?? 0));
      const best = bestSet(ls)!;
      const vol = ls.reduce((s, l) => s + (l.reps ?? 0) * Number(l.weight ?? 0), 0);
      const reps = ls.reduce((s, l) => s + (l.reps ?? 0), 0);
      const sessions = new Set(ls.map((l) => l.performed_on)).size;
      const y = metric === 'peso' ? maxW : metric === 'volumen' ? vol : metric === 'reps' ? reps : Math.round(e1rm(Number(best.weight ?? 0), best.reps!) * 10) / 10;
      return {
        x: w, y, label: fmtDate(w),
        detail: metric === 'e1rm' ? `mejor serie ${setText(best.weight, best.reps)}` : `tope ${setText(maxW, topReps)}`,
        note: `${ls.length} series · ${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}`,
      };
    });
}

/** Sesiones de un ejercicio, de la más reciente a la más vieja. */
function sessionsOf(logs: SetLog[]) {
  const byDay = new Map<string, SetLog[]>();
  logs.forEach((l) => byDay.set(l.performed_on, [...(byDay.get(l.performed_on) ?? []), l]));
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, ls]) => {
      const sets = [...ls].sort((a, b) => a.set_number - b.set_number);
      const best = bestSet(sets);
      const vol = sets.reduce((s, l) => s + (l.reps ?? 0) * Number(l.weight ?? 0), 0);
      return { day, sets, best, vol };
    });
}

export function E1rmExplainer() {
  return (
    <p className="notice small" style={{ margin: 0 }}>
      <b>¿Qué es el 1RM estimado?</b> Es el peso máximo que se calcula que podrías levantar <b>una sola vez</b>, a partir de una serie
      con más repeticiones (fórmula de Epley: peso × (1 + reps ÷ 30)). Sirve para comparar series distintas: <b>100 kg × 12</b> y
      <b> 110 kg × 8</b> equivalen a unos 140 y 139 kg. No hace falta probar ese peso: es una referencia de cómo evoluciona la fuerza.
      Es más preciso con series de hasta ~12 repeticiones.
    </p>
  );
}

export function TrainingHistory({ routine, logs }: { routine: FullRoutine; logs: SetLog[] }) {
  const [metric, setMetric] = useState<Metric>('peso');
  const [dayId, setDayId] = useState<string>('all');
  const [openTable, setOpenTable] = useState<string | null>(null);
  const m = METRICS.find((x) => x.key === metric)!;
  const days = routine.days.filter((d) => dayId === 'all' || d.id === dayId);
  const showE1 = metric === 'e1rm';

  return (
    <div className="stack-lg">
      <div className="stack" style={{ gap: 8 }}>
        <div className="chips" role="tablist" aria-label="Día de entrenamiento">
          <button className={`chip ${dayId === 'all' ? 'on' : ''}`} onClick={() => setDayId('all')}>Todos</button>
          {routine.days.map((d) => (
            <button key={d.id} className={`chip ${dayId === d.id ? 'on' : ''}`} onClick={() => setDayId(d.id)}>{d.title}</button>
          ))}
        </div>
        <div className="chips" role="tablist" aria-label="Métrica">
          {METRICS.map((x) => (
            <button key={x.key} className={`chip ${metric === x.key ? 'on' : ''}`} onClick={() => setMetric(x.key)}>
              {x.label}{x.key === 'e1rm' ? ' ⓘ' : ''}
            </button>
          ))}
        </div>
        {showE1 && <E1rmExplainer />}
      </div>

      {days.map((d) => (
        <section key={d.id} className="sheet">
          <span className="punch" style={{ top: 26 }} />
          <div className="row between wrap">
            <h2 className="h-hand">{d.title}</h2>
            {d.day_of_week && <span className="type">{DAYS[d.day_of_week - 1]}</span>}
          </div>
          <div className="grid-2" style={{ marginTop: 14, gap: 26 }}>
            {d.exercises.map((re) => {
              const mine = logs.filter((l) => l.routine_exercise_id === re.id);
              const main = mine.filter((l) => l.exercise_id === re.exercise_id);
              const swaps = new Set(mine.filter((l) => l.exercise_id !== re.exercise_id).map((l) => l.performed_on)).size;
              const pts = weekly(main, metric);
              const sess = sessionsOf(main);
              const last = sess[0];
              const open = openTable === re.id;
              return (
                <div key={re.id} style={{ minWidth: 0 }}>
                  <div className="row between wrap" style={{ gap: 4 }}>
                    <h3 className="h-hand" style={{ fontSize: '1.45rem' }}>{re.exercise.name}</h3>
                    <span className="type">{re.sets}×{re.rep_min}–{re.rep_max}{re.target_weight != null && ` · ${re.target_weight} kg`}</span>
                  </div>
                  {last && (
                    <p className="small" style={{ margin: '2px 0 4px' }}>
                      Última sesión ({fmtDate(last.day)}): <b className="ink" style={{ fontSize: '1.2rem' }}>{last.sets.filter(done).map((l) => setText(l.weight, l.reps)).join(' · ')}</b>
                    </p>
                  )}
                  <LineChart data={pts} unit={m.unit} ariaLabel={`${m.label} semanal de ${re.exercise.name}`} />
                  {swaps > 0 && <p className="type muted" style={{ margin: 0 }}>Reemplazado {swaps} {swaps === 1 ? 'vez' : 'veces'} (no cuenta en el gráfico)</p>}
                  {sess.length > 0 && (
                    <button className="btn ghost sm" onClick={() => setOpenTable(open ? null : re.id)} aria-expanded={open}>
                      {open ? 'Ocultar sesiones' : `Ver sesiones (${sess.length})`}
                    </button>
                  )}
                  {open && (
                    <div className="scroll-x">
                      <table className="ledger sessions">
                        <thead><tr><th>Fecha</th><th>Series (kg × reps)</th><th>Mejor serie</th>{showE1 && <th>1RM est.</th>}<th>Volumen</th></tr></thead>
                        <tbody>
                          {sess.map((x) => (
                            <Fragment key={x.day}>
                              <tr>
                                <td className="type" style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.day, { day: 'numeric', month: 'short' })}</td>
                                <td className="ink" style={{ fontSize: '1.15rem' }}>{x.sets.map((l) => (done(l) ? setText(l.weight, l.reps) : 'salteada')).join(' · ')}</td>
                                <td><b>{x.best ? setText(x.best.weight, x.best.reps) : '—'}</b></td>
                                {showE1 && <td>{x.best ? `${kg(e1rm(Number(x.best.weight ?? 0), x.best.reps!))} kg` : '—'}</td>}
                                <td className="type">{kg(x.vol)} kg</td>
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {!d.exercises.length && <p className="muted">Este día no tiene ejercicios.</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

export function MeasurementsHistory({ items }: { items: Measurement[] }) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.measured_on.localeCompare(b.measured_on)), [items]);
  const fields = MEASURE_FIELDS.filter((f) => sorted.some((m) => m[f.key] != null));
  if (!sorted.length) return <div className="sheet plain empty">Todavía no hay mediciones cargadas.</div>;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return (
    <div className="stack-lg">
      <div className="grid-2">
        {fields.map((f) => {
          const pts: Point[] = sorted
            .filter((m) => m[f.key] != null)
            .map((m) => ({ x: m.measured_on, y: Number(m[f.key]), label: fmtDate(m.measured_on) }));
          const a = first[f.key] as number | null;
          const b = last[f.key] as number | null;
          const diff = a != null && b != null ? Number(b) - Number(a) : null;
          return (
            <section key={f.key} className="sheet grid-paper">
              <div className="row between">
                <h3 className="h-hand">{f.label}</h3>
                {diff != null && pts.length > 1 && (
                  <span className="note-hand" style={{ color: 'var(--graphite-2)' }}>
                    {diff > 0 ? '+' : ''}{diff.toLocaleString('es-AR', { maximumFractionDigits: 1 })} {f.unit}
                  </span>
                )}
              </div>
              <LineChart data={pts} unit={f.unit} height={150} ariaLabel={`Evolución de ${f.label}`} />
            </section>
          );
        })}
      </div>
      <section className="sheet plain scroll-x">
        <h3 className="h-hand" style={{ marginBottom: 8 }}>Todas las mediciones</h3>
        <table className="ledger">
          <thead>
            <tr><th>Fecha</th>{MEASURE_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((m) => (
              <tr key={m.id}>
                <td className="type">{fmtDate(m.measured_on, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                {MEASURE_FIELDS.map((f) => <td key={f.key} className="ink" style={{ fontSize: '1.3rem' }}>{m[f.key] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
