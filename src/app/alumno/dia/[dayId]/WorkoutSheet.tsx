'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise, FullRoutine, SetLog } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, fmtKg, num, todayISO } from '@/lib/utils';
import VideoButton from '@/components/VideoButton';
import Celebration from '@/components/Celebration';
import { notify } from '@/lib/notify';
import RestTimer, { type Rest } from '@/components/RestTimer';
import { enqueue, flushQueue, isNetworkError, readQueue, setKey, type PendingOp, type SetRow } from '@/lib/offlineSets';
import { IconCheck, IconSwap } from '@/components/Icons';

type Day = FullRoutine['days'][number];
type Rex = Day['exercises'][number];
type Cell = { reps: string; weight: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

const key = (rexId: string, n: number) => `${rexId}:${n}`;
/** Selecciona el contenido del casillero (después del autocompletado) para que lo que se escriba lo reemplace. */
const selectAll = (el: HTMLInputElement) => requestAnimationFrame(() => { try { el.select(); } catch { /* */ } });

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

  const [queued, setQueued] = useState(0);
  const [rest, setRest] = useState<Rest>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const rexById = useMemo(() => new Map(day.exercises.map((e) => [e.id, e])), [day.exercises]);

  // Al abrir: mostrar lo que quedó guardado en el teléfono sin subir (de esta fecha).
  useEffect(() => {
    const mine = readQueue().filter((op) => op.type !== 'swap' && (op.type === 'upsert' ? op.row.performed_on : op.performed_on) === date && rexById.has(op.type === 'upsert' ? op.row.routine_exercise_id : op.routine_exercise_id));
    if (mine.length) {
      setCells((c) => {
        const next = { ...c };
        for (const op of mine) {
          if (op.type === 'upsert') next[key(op.row.routine_exercise_id, op.row.set_number)] = { reps: op.row.reps?.toString() ?? '', weight: op.row.weight?.toString() ?? '' };
          else if (op.type === 'delete') delete next[key(op.routine_exercise_id, op.set_number)];
        }
        return next;
      });
    }
    setQueued(readQueue().length);
  }, [date, rexById]);

  const checkProgression = useCallback(async (rex: Rex) => {
    if (pending.has(rex.id)) return;
    const { data } = await sb.from('progression_requests').select('id').eq('routine_exercise_id', rex.id).eq('status', 'pending').maybeSingle();
    if (data) {
      setPending((p) => new Set(p).add(rex.id));
      setReached(rex);
      notify('progression_requested', data.id);
    }
  }, [pending, sb]);

  /** Sube lo pendiente; tras subir series en el tope del rango, revisa la progresión. */
  const flush = useCallback(async () => {
    if (!readQueue().length) return;
    const r = await flushQueue(sb);
    setQueued(r.remaining);
    // Lo rechazado se puede volver a cargar (aunque sea el mismo valor).
    for (const op of r.rejectedOps) if (op.type === 'upsert') delete saved.current[key(op.row.routine_exercise_id, op.row.set_number)];
    if (r.rejected) { setState('error'); flash(`No se pudo guardar ${r.rejected === 1 ? '1 serie' : `${r.rejected} series`}: revisá los valores y volvé a cargarlas.`); }
    else if (r.uploaded.length && !r.remaining) { setState('saved'); flash('✓ Se subieron las series guardadas sin señal'); }
    const tops = new Set(r.uploaded.filter((u) => { const x = rexById.get(u.routine_exercise_id); return x && u.reps != null && u.reps >= x.rep_max; }).map((u) => u.routine_exercise_id));
    tops.forEach((id) => { const x = rexById.get(id); if (x) checkProgression(x); });
  }, [sb, rexById, checkProgression]);

  useEffect(() => {
    flush();
    const on = () => flush();
    const vis = () => { if (document.visibilityState === 'visible') flush(); };
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(() => { if (readQueue().length) flush(); }, 20000);
    return () => { window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, [flush]);

  function startRest(rex: Rex, n: number) {
    const secs = rex.rest_seconds ?? 90;
    if (secs <= 0) return;
    setRest({ endAt: Date.now() + secs * 1000, total: secs, label: `${rex.exercise.name}${n < rex.sets ? ` · serie ${n + 1} de ${rex.sets}` : ' · siguiente ejercicio'}` });
  }

  async function saveCell(rex: Rex, n: number) {
    const k = key(rex.id, n);
    const c = cells[k] ?? { reps: '', weight: '' };
    const reps = num(c.reps);
    const weight = num(c.weight);
    const sig = `${reps ?? ''}|${weight ?? ''}`;
    if (saved.current[k] === sig || (saved.current[k] === undefined && sig === '|')) return;
    if ((weight != null && (weight < 0 || weight > 1000)) || (reps != null && (reps < 0 || reps > 200))) {
      setState('error');
      flash(`Revisá la serie ${n}: ${weight != null && weight > 1000 ? `${weight} kg` : `${reps} reps`} no parece correcto.`);
      return;
    }
    const repsChanged = reps != null && (saved.current[k] ?? '|').split('|')[0] !== String(Math.round(reps));
    setState('saving');
    const exerciseId = chosen[rex.id] ?? rex.exercise_id;
    const row: SetRow = { student_id: studentId, routine_exercise_id: rex.id, exercise_id: exerciseId, performed_on: date, set_number: n, reps: reps == null ? null : Math.round(reps), weight };
    const op: PendingOp = reps == null && weight == null
      ? { k: setKey(rex.id, date, n), type: 'delete', routine_exercise_id: rex.id, performed_on: date, set_number: n }
      : { k: setKey(rex.id, date, n), type: 'upsert', row };
    if (repsChanged) startRest(rex, n);

    // Sin señal, o con cambios esperando: a la cola, para respetar el orden.
    const offline = !navigator.onLine;
    if (offline || readQueue().length) {
      saved.current[k] = sig;
      setQueued(enqueue(op));
      setState('offline');
      if (!offline) flush();
      return;
    }
    const res = op.type === 'delete'
      ? await sb.from('set_logs').delete().match({ routine_exercise_id: rex.id, performed_on: date, set_number: n })
      : await sb.from('set_logs').upsert(row, { onConflict: 'routine_exercise_id,performed_on,set_number' });
    if (res.error && isNetworkError(res.error)) {
      saved.current[k] = sig;
      setQueued(enqueue(op));
      setState('offline');
      return;
    }
    if (res.error) {
      setState('error');
      flash('No se pudo guardar: ' + res.error.message);
      return;
    }
    saved.current[k] = sig;
    setState('saved');
    if (reps != null && reps >= rex.rep_max) checkProgression(rex);
  }

  async function changeExercise(rex: Rex, exId: string) {
    setChosen((m) => ({ ...m, [rex.id]: exId }));
    // También cambia las series que esperan en la cola
    for (const op of readQueue()) if (op.type === 'upsert' && op.row.routine_exercise_id === rex.id && op.row.performed_on === date) enqueue({ ...op, row: { ...op.row, exercise_id: exId } });
    const swapOp: PendingOp = { k: `swap:${rex.id}:${date}`, type: 'swap', routine_exercise_id: rex.id, performed_on: date, exercise_id: exId };
    if (!navigator.onLine) { setQueued(enqueue(swapOp)); flash('Sin señal: el cambio se guarda cuando vuelva'); return; }
    const { error } = await sb.from('set_logs').update({ exercise_id: exId }).match({ routine_exercise_id: rex.id, performed_on: date });
    if (error && isNetworkError(error)) { setQueued(enqueue(swapOp)); flash('Sin señal: el cambio se guarda cuando vuelva'); return; }
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
          {state === 'saving' ? 'Guardando…' : state === 'offline' ? '📵 Guardado en el teléfono' : state === 'saved' ? '✓ Guardado' : state === 'error' ? '⚠ Sin guardar' : isToday ? 'Hoy' : fmtDate(date)}
          {' · '}{done}/{day.exercises.length} ejercicios
        </span>
      </div>

      {queued > 0 && (
        <div className="notice amber offline-banner" role="status">
          📵 Sin señal: {queued === 1 ? '1 cambio guardado' : `${queued} cambios guardados`} en el teléfono. Se suben solos cuando vuelva la conexión.
          {' '}<button className="btn ghost sm" onClick={() => flush()}>Reintentar ahora</button>
        </div>
      )}

      {day.exercises.map((rex, idx) => {
        const exId = chosen[rex.id] ?? rex.exercise_id;
        const isSwap = exId !== rex.exercise_id;
        const ex: Exercise = isSwap ? rex.alternatives.find((a) => a.id === exId) ?? rex.exercise : rex.exercise;
        const prev = previous[rex.id] ?? [];
        const prevDate = prev[0]?.performed_on;
        // Sin carga pautada por el profe: la de esta sesión pasa a ser la carga inicial.
        const todayWeights = Array.from({ length: rex.sets }, (_, i) => num(cells[key(rex.id, i + 1)]?.weight)).filter((w): w is number => w != null);
        const choosing = !isSwap && (rex.target_weight == null || (rex.target_source === 'student' && rex.target_set_on === date));
        const shownTarget = choosing ? (todayWeights.length ? Math.min(...todayWeights) : null) : rex.target_weight;
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
                  {!isSwap && shownTarget != null && (
                    <span>carga <b className="mark">{fmtKg(shownTarget)}</b>{rex.target_source === 'student' || choosing ? ' (tuya)' : ''}</span>
                  )}
                  {!isSwap && shownTarget == null && <span>carga <b>la elegís vos</b></span>}
                  <button type="button" className="rest-chip" onClick={() => setRest({ endAt: Date.now() + (rex.rest_seconds ?? 90) * 1000, total: rex.rest_seconds ?? 90, label: rex.exercise.name })} aria-label="Iniciar descanso">
                    ⏱ pausa <b>{(rex.rest_seconds ?? 90) >= 60 ? `${+((rex.rest_seconds ?? 90) / 60).toFixed(1)}′` : `${rex.rest_seconds}″`}</b>
                  </button>
                </div>
              </div>
              <VideoButton exercise={ex} />
            </div>
            {rex.notes && <p className="note-hand" style={{ margin: '8px 0 0' }}>{rex.notes}</p>}
            {choosing && (
              <p className="notice amber small" style={{ margin: '10px 0 0' }}>
                Elegí un peso con el que llegues a {rex.rep_min}–{rex.rep_max} reps con buena técnica. El de hoy queda como tu <b>carga inicial</b>
                {todayWeights.length > 0 && <> (<b>{fmtKg(Math.min(...todayWeights))}</b>)</>} y tu profe lo va a ver.
              </p>
            )}
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
                          placeholder={rex.target_weight != null && !isSwap ? String(rex.target_weight) : p?.weight?.toString() ?? 'kg'}
                          value={c.weight} onFocus={(e) => { focusWeight(rex, n); selectAll(e.currentTarget); }} onChange={(e) => set(k, 'weight', e.target.value)} onBlur={() => saveCell(rex, n)} />
                        {p && <span className="prev">antes {p.weight ?? '–'}</span>}
                      </td>
                      <td>
                        <input className="cell-in" inputMode="numeric" enterKeyHint="next" aria-label={`Repeticiones serie ${n}`}
                          placeholder={`${rex.rep_min}–${rex.rep_max}`} value={c.reps} onFocus={(e) => selectAll(e.currentTarget)}
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

      <RestTimer rest={rest} onChange={setRest} />
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
