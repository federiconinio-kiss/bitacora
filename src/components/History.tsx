'use client';
import { useMemo, useState } from 'react';
import type { FullRoutine, Measurement, SetLog } from '@/lib/types';
import { MEASURE_FIELDS } from '@/lib/types';
import { DAYS, fmtDate, weekStart } from '@/lib/utils';
import LineChart, { type Point } from './LineChart';

type Metric = 'peso' | 'volumen' | 'reps';
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'peso', label: 'Peso máximo', unit: 'kg' },
  { key: 'volumen', label: 'Volumen', unit: 'kg' },
  { key: 'reps', label: 'Repeticiones', unit: 'reps' },
];

/** Serie semanal por ejercicio: peso máximo, volumen (reps × kg) y reps totales. */
function weekly(logs: SetLog[], metric: Metric): Point[] {
  const byWeek = new Map<string, SetLog[]>();
  logs.forEach((l) => {
    if (l.reps == null) return;
    const w = weekStart(l.performed_on);
    byWeek.set(w, [...(byWeek.get(w) ?? []), l]);
  });
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, ls]) => {
      const maxW = Math.max(...ls.map((l) => Number(l.weight ?? 0)));
      const top = ls.filter((l) => Number(l.weight ?? 0) === maxW);
      const bestReps = Math.max(...top.map((l) => l.reps ?? 0));
      const vol = ls.reduce((s, l) => s + (l.reps ?? 0) * Number(l.weight ?? 0), 0);
      const reps = ls.reduce((s, l) => s + (l.reps ?? 0), 0);
      const sessions = new Set(ls.map((l) => l.performed_on)).size;
      const y = metric === 'peso' ? maxW : metric === 'volumen' ? vol : reps;
      return {
        x: w,
        y,
        label: fmtDate(w),
        detail: `${maxW} kg × ${bestReps} · ${ls.length} series · ${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}`,
      };
    });
}

export function TrainingHistory({ routine, logs }: { routine: FullRoutine; logs: SetLog[] }) {
  const [metric, setMetric] = useState<Metric>('peso');
  const [dayId, setDayId] = useState<string>('all');
  const m = METRICS.find((x) => x.key === metric)!;
  const days = routine.days.filter((d) => dayId === 'all' || d.id === dayId);

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
            <button key={x.key} className={`chip ${metric === x.key ? 'on' : ''}`} onClick={() => setMetric(x.key)}>{x.label}</button>
          ))}
        </div>
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
              return (
                <div key={re.id}>
                  <div className="row between wrap" style={{ gap: 4 }}>
                    <h3 className="h-hand" style={{ fontSize: '1.45rem' }}>{re.exercise.name}</h3>
                    <span className="type">{re.sets}×{re.rep_min}–{re.rep_max}{re.target_weight != null && ` · ${re.target_weight} kg`}</span>
                  </div>
                  <LineChart data={pts} unit={m.unit} ariaLabel={`${m.label} semanal de ${re.exercise.name}`} />
                  {swaps > 0 && <p className="type muted" style={{ margin: 0 }}>Reemplazado {swaps} {swaps === 1 ? 'vez' : 'veces'} (no cuenta en el gráfico)</p>}
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
