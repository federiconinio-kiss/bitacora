'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise, FullRoutine, SetLog } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, fmtKg, num, todayISO } from '@/lib/utils';
import VideoButton from '@/components/VideoButton';
import Celebration from '@/components/Celebration';
import { IconCheck, IconSwap } from '@/components/Icons';

type Day = FullRoutine['days'][number];
type Rex = Day['exercises'][number];
type Cell = { reps: string; weight: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const key = (rexId: string, n: number) => `${rexId}:${n}`;

export default function WorkoutSheet({ studentId, date, day, initial, previous, pendingIds }: {
  studentId: string; date: string; day: Day; initial: SetLog[]; previous: Record<string, SetLog[]>; pendingIds: string[];
}) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const c: Record<string, Cell> = {};
    initial.forEach((l) => (c[key(l.routine_exercise_id, l.set_number)] = { reps: l.reps?.toString() ?? '', weight: l.weight?.toString() ?? '' }));
    return c;
  });
  const [chosen, setChosen] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial.forEach((l) => (m[l.routine_exercise_id] = l.exercise_id));
    return m;
  });
  const [pending, setPending] = useState<Set<string>>(new Set(pendingIds));
  const [state, setState] = useState<SaveState>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [reached, setReached] = useState<Rex | null>(null);
  const saved = useRef<Record<string, string>>(
    Object.fromEntries(initial.map((l) => [key(l.routine_exercise_id, l.set_number), `${l.reps ?? ''}|${l.weight ?? ''}`])),
  );

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const checkProgression = useCallback(async (rex: Rex) => {
    if (pending.has(rex.id)) return;
    const { data } = await sb.from('progression_requests').select('id').eq('routine_exercise_id', rex.id).eq('status', 'pending').maybeSingle();
    if (data) {
      setPending((p) => new Set(p).add(rex.id));
      setReached(rex);
    }
  }, [pending, sb]);

  async function saveCell(rex: Rex, n: number) {
    const k = key(rex.id, n);
    const c = cells[k] ?? { reps: '', weight: '' };
    const reps = num(c.reps);
    const weight = num(c.weight);
    const sig = `${reps ?? ''}|${weight ?? ''}`;
    if (saved.current[k] === sig || (saved.current[k] === undefined && sig === '|')) return;
    setState('saving');
    const exerciseId = chosen[rex.id] ?? rex.exercise_id;
    const res = reps == null && weight == null
      ? await sb.from('set_logs').delete().match({ routine_exercise_id: rex.id, performed_on: date, set_number: n })
      : await sb.from('set_logs').upsert(
          { student_id: studentId, routine_exercise_id: rex.id, exercise_id: exerciseId, performed_on: date, set_number: n, reps: reps == null ? null : Math.round(reps), weight },
          { onConflict: 'routine_exercise_id,performed_on,set_number' },
        );
    if (res.error) {
      setState('error');
      flash('No se pudo guardar. Revisá tu conexión.');
      return;
    }
    saved.current[k] = sig;
    setState('saved');
    if (reps != null && reps >= rex.rep_max) checkProgression(rex);
  }

  async function changeExercise(rex: Rex, exId: string) {
    setChosen((m) => ({ ...m, [rex.id]: exId }));
    const { error } = await sb.from('set_logs').update({ exercise_id: exId }).match({ routine_exercise_id: rex.id, performed_on: date });
    if (error) flash('No se pudo cambiar el ejercicio.');
    else flash(exId === rex.exercise_id ? 'Volviste al ejercicio original' : 'Ejercicio reemplazado');
  }

  function set(k: string, field: keyof Cell, v: string) {
    setCells((c) => ({ ...c, [k]: { ...(c[k] ?? { reps: '', weight: '' }), [field]: v } }));
  }

  /** Copia el peso de la serie anterior para no tener que reescribirlo. */
  function focusWeight(rex: Rex, n: number) {
    const k = key(rex.id, n);
    if (cells[k]?.weight) return;
    const prev = n > 1 ? cells[key(rex.id, n - 1)]?.weight : '';
    if (prev) set(k, 'weight', prev);
  }

  const isToday = date === todayISO();
  const done = useMemo(() => day.exercises.filter((e) => Array.from({ length: e.sets }, (_, i) => cells[key(e.id, i + 1)]?.reps).filter(Boolean).length >= e.sets).length, [cells, day.exercises]);

  return (
    <>
      <div className="row between wrap" style={{ gap: 8 }}>
        <label className="row" style={{ gap: 8 }}>
          <span className="type">Fecha</span>
          <input type="date" className="input box" style={{ width: 'auto', fontSize: '1.2rem' }} value={date} max={todayISO()}
            onChange={(e) => e.target.value && router.replace(`?fecha=${e.target.value}`)} />
        </label>
        <span className="type" aria-live="polite">
          {state === 'saving' ? 'Guardando…' : state === 'saved' ? '✓ Guardado' : state === 'error' ? '⚠ Sin guardar' : isToday ? 'Hoy' : fmtDate(date)}
          {' · '}{done}/{day.exercises.length} ejercicios
        </span>
      </div>

      {day.exercises.map((rex, idx) => {
        const exId = chosen[rex.id] ?? rex.exercise_id;
        const isSwap = exId !== rex.exercise_id;
        const ex: Exercise = isSwap ? rex.alternatives.find((a) => a.id === exId) ?? rex.exercise : rex.exercise;
        const prev = previous[rex.id] ?? [];
        const prevDate = prev[0]?.performed_on;
        return (
          <section key={rex.id} className="sheet ex-card">
            <span className="punch" style={{ top: 24 }} />
            <div className="ex-head">
              <span className="ex-num">{idx + 1}.</span>
              <div className="grow">
                <div className="ex-title">{ex.name}</div>
                {isSwap && <div className="type" style={{ color: 'var(--amber)' }}>en lugar de {rex.exercise.name}</div>}
                <div className="ex-meta">
                  <span><b>{rex.sets}</b> series</span>
                  <span><b>{rex.rep_min}–{rex.rep_max}</b> reps</span>
                  {rex.target_weight != null && !isSwap && <span>carga <b className="mark">{fmtKg(rex.target_weight)}</b></span>}
                  {rex.rest_seconds != null && <span>pausa <b>{rex.rest_seconds >= 60 ? `${+(rex.rest_seconds / 60).toFixed(1)}′` : `${rex.rest_seconds}″`}</b></span>}
                </div>
              </div>
              <VideoButton exercise={ex} />
            </div>
            {rex.notes && <p className="note-hand" style={{ margin: '8px 0 0' }}>{rex.notes}</p>}
            {pending.has(rex.id) && !isSwap && (
              <p className="notice green small" style={{ margin: '10px 0 0' }}>¡Tope del rango alcanzado! Tu profe va a revisar la subida de carga.</p>
            )}

            {rex.alternatives.length > 0 && (
              <div className="swap">
                <label className="row" style={{ gap: 8 }}>
                  <IconSwap size={20} />
                  <span className="small">¿Máquina ocupada? Hacé:</span>
                </label>
                <select className="select" style={{ fontSize: '1.2rem', textOverflow: 'ellipsis' }} value={exId} onChange={(e) => changeExercise(rex, e.target.value)} aria-label="Ejercicio a realizar">
                  <option value={rex.exercise_id}>✓ {rex.exercise.name}</option>
                  {rex.alternatives.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <table className="sets">
              <thead>
                <tr><th>Serie</th><th style={{ textAlign: 'center' }}>Peso (kg)</th><th style={{ textAlign: 'center' }}>Reps</th><th /></tr>
              </thead>
              <tbody>
                {Array.from({ length: rex.sets }, (_, i) => i + 1).map((n) => {
                  const k = key(rex.id, n);
                  const c = cells[k] ?? { reps: '', weight: '' };
                  const p = prev.find((l) => l.set_number === n);
                  const r = num(c.reps);
                  const top = r != null && r >= rex.rep_max;
                  return (
                    <tr key={n} className={r != null ? 'done' : ''}>
                      <td className="n">{n}</td>
                      <td>
                        <input className="cell-in" inputMode="decimal" enterKeyHint="next" aria-label={`Peso serie ${n}`}
                          placeholder={rex.target_weight != null && !isSwap ? String(rex.target_weight) : p?.weight?.toString() ?? '–'}
                          value={c.weight} onFocus={() => focusWeight(rex, n)} onChange={(e) => set(k, 'weight', e.target.value)} onBlur={() => saveCell(rex, n)} />
                        {p && <span className="prev">antes {p.weight ?? '–'}</span>}
                      </td>
                      <td>
                        <input className="cell-in" inputMode="numeric" enterKeyHint="next" aria-label={`Repeticiones serie ${n}`}
                          placeholder={`${rex.rep_min}–${rex.rep_max}`} value={c.reps}
                          onChange={(e) => set(k, 'reps', e.target.value.replace(/\D/g, ''))} onBlur={() => saveCell(rex, n)} />
                        {p && <span className="prev">antes {p.reps ?? '–'}</span>}
                      </td>
                      <td className="ok">
                        <span className={`check ${r == null ? 'hidden' : ''}`} style={top ? { color: 'var(--red)' } : undefined} title={top ? 'Tope del rango' : 'Hecha'}>
                          {top ? '★' : <IconCheck size={26} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {prevDate && <p className="type muted" style={{ margin: '6px 0 0' }}>“antes” = sesión del {fmtDate(prevDate)}</p>}
          </section>
        );
      })}

      {!day.exercises.length && <div className="sheet empty">Este día todavía no tiene ejercicios.</div>}

      {toast && <div className="toast" role="status">{toast}</div>}
      {reached && (
        <Celebration
          title="¡Tope del rango!"
          stamp="Aviso al profe"
          festive={false}
          lines={[
            <span key="a">Completaste todas las series de <b>{reached.exercise.name}</b> en {reached.rep_max} reps.</span>,
            <span key="b" className="muted">Ya le avisamos a tu profe para que apruebe la subida de carga.</span>,
          ]}
          onClose={() => setReached(null)}
        />
      )}
    </>
  );
}
