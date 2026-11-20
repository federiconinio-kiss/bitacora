'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise, FullRoutine, SetLog, WorkoutSession } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, fmtKg, num, todayISO } from '@/lib/utils';
import VideoButton from '@/components/VideoButton';
import { setText } from '@/components/History';
import Celebration from '@/components/Celebration';
import Modal from '@/components/Modal';
import { notify } from '@/lib/notify';
import RestTimer, { type Rest } from '@/components/RestTimer';
import { enqueue, flushQueue, isNetworkError, readQueue, setKey, type PendingOp, type SetRow } from '@/lib/offlineSets';
import { SKIP_REASONS, dayProgress, finishSession, fmtDuration, startSession, writeActive } from '@/lib/workout';
import { IconCheck, IconSwap } from '@/components/Icons';

type Day = FullRoutine['days'][number];
type Rex = Day['exercises'][number];
type Cell = { reps: string; weight: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';
type Progress = ReturnType<typeof dayProgress>;

const key = (rexId: string, n: number) => `${rexId}:${n}`;
/** Selecciona el contenido del casillero (después del autocompletado) para que lo que se escriba lo reemplace. */
const selectAll = (el: HTMLInputElement) => requestAnimationFrame(() => { try { el.select(); } catch { /* */ } });
const STALE_MS = 90 * 60 * 1000;

export default function WorkoutSheet({ studentId, routineId, date, day, initial, previous, pendingIds, initialSession }: {
  studentId: string; routineId: string; date: string; day: Day; initial: SetLog[]; previous: Record<string, SetLog[]>; pendingIds: string[];
  initialSession: WorkoutSession | null;
}) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const c: Record<string, Cell> = {};
    initial.filter((l) => !l.skipped).forEach((l) => (c[key(l.routine_exercise_id, l.set_number)] = { reps: l.reps?.toString() ?? '', weight: l.weight?.toString() ?? '' }));
    return c;
  });
  const [skips, setSkips] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initial.filter((l) => l.skipped).map((l) => [key(l.routine_exercise_id, l.set_number), l.skip_reason ?? null])));
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
    Object.fromEntries(initial.map((l) => [key(l.routine_exercise_id, l.set_number), l.skipped ? 'skip' : `${l.reps ?? ''}|${l.weight ?? ''}`])),
  );
  const [queued, setQueued] = useState(0);
  const [rest, setRest] = useState<Rest>(null);

  // Sesión de entrenamiento
  const [session, setSession] = useState<WorkoutSession | null>(initialSession);
  const [now, setNow] = useState(() => Date.now());
  const [modal, setModal] = useState<
    | { kind: 'finish' }
    | { kind: 'leave'; href: string }
    | { kind: 'stale' }
    | { kind: 'skip'; rex: Rex; sets: number[] }
    | { kind: 'summary'; progress: Progress; ms: number; reason: 'completo' | 'manual' }
    | null
  >(null);
  const finishing = useRef(false);
  const leaving = useRef(false);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const rexById = useMemo(() => new Map(day.exercises.map((e) => [e.id, e])), [day.exercises]);
  const isToday = date === todayISO();
  const active = !!session && !session.ended_at;

  // Avance según lo que se ve en pantalla
  const progress = useMemo(() => {
    const logs = day.exercises.flatMap((e) => Array.from({ length: e.sets }, (_, i) => {
      const k = key(e.id, i + 1);
      const c = cells[k];
      return { routine_exercise_id: e.id, set_number: i + 1, reps: num(c?.reps), weight: num(c?.weight), skipped: k in skips, skip_reason: skips[k] ?? null };
    }));
    return dayProgress(day, logs);
  }, [cells, skips, day]);

  // Al abrir: mostrar lo que quedó guardado en el teléfono sin subir (de esta fecha).
  useEffect(() => {
    const mine = readQueue().filter((op) => op.type !== 'swap' && (op.type === 'upsert' ? op.row.performed_on : op.performed_on) === date && rexById.has(op.type === 'upsert' ? op.row.routine_exercise_id : op.routine_exercise_id));
    if (mine.length) {
      setCells((c) => {
        const next = { ...c };
        for (const op of mine) {
          if (op.type === 'upsert' && !op.row.skipped) next[key(op.row.routine_exercise_id, op.row.set_number)] = { reps: op.row.reps?.toString() ?? '', weight: op.row.weight?.toString() ?? '' };
          else if (op.type === 'delete') delete next[key(op.routine_exercise_id, op.set_number)];
        }
        return next;
      });
      setSkips((sk) => {
        const next = { ...sk };
        for (const op of mine) {
          if (op.type === 'upsert' && op.row.skipped) next[key(op.row.routine_exercise_id, op.row.set_number)] = op.row.skip_reason ?? null;
          else if (op.type === 'delete' || (op.type === 'upsert' && !op.row.skipped)) delete next[key(op.type === 'upsert' ? op.row.routine_exercise_id : op.routine_exercise_id, op.type === 'upsert' ? op.row.set_number : op.set_number)];
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

  // ------------------------------ Sesión ------------------------------
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Datos para la barra "entrenamiento en curso" de las otras secciones
  useEffect(() => {
    if (active && session) writeActive({ id: session.id, dayId: day.id, dayTitle: day.title, startedAt: session.started_at, total: progress.total, done: progress.done + progress.skipped });
  }, [active, session, day.id, day.title, progress.total, progress.done, progress.skipped]);

  async function ensureSession() {
    if (session && !session.ended_at) return session;
    if (!isToday || (session && session.ended_at)) return null;
    try {
      const s = await startSession(sb, { studentId, routineId, day, date });
      setSession(s);
      setNow(Date.now());
      return s;
    } catch (e) {
      if (!isNetworkError(e as Error)) flash('No se pudo iniciar el entrenamiento.');
      return null;
    }
  }

  async function start() {
    const s = await ensureSession();
    if (s) flash('▶ ¡Arrancamos! El cronómetro está corriendo');
  }

  async function reopen() {
    if (!session) return;
    const { data, error } = await sb.from('workout_sessions').update({ ended_at: null, end_reason: null }).eq('id', session.id).select('*').single();
    if (error) return flash('No se pudo reabrir.');
    setSession(data as WorkoutSession);
  }

  const doFinish = useCallback(async (reason: 'completo' | 'manual', then?: string) => {
    if (!session || session.ended_at || finishing.current) return;
    finishing.current = true;
    try {
      const r = await finishSession(sb, session, day, reason, progress);
      setSession(r.session);
      setRest(null);
      const ms = new Date(r.session.ended_at!).getTime() - new Date(r.session.started_at).getTime();
      if (then) { leaving.current = true; router.push(then); }
      else setModal({ kind: 'summary', progress: r.progress, ms, reason });
    } catch (e) {
      flash(isNetworkError(e as Error) ? 'Sin señal: finalizá el entrenamiento cuando vuelva la conexión.' : 'No se pudo finalizar. Probá de nuevo.');
    } finally {
      finishing.current = false;
    }
  }, [session, sb, day, progress, router]);

  // a) Fin automático: todas las series cargadas (o salteadas)
  useEffect(() => {
    if (active && progress.complete && !modal) doFinish('completo');
  }, [active, progress.complete, modal, doFinish]);

  // d) Más de 1,5 h sin finalizar (con la app abierta). Fuera de la app avisa la notificación.
  useEffect(() => {
    if (!active || !session || modal) return;
    const flag = `ecf:stale-asked:${session.id}`;
    if (now - new Date(session.started_at).getTime() > STALE_MS) {
      try { if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, '1'); } catch { /* */ }
      setModal({ kind: 'stale' });
    }
  }, [now, active, session, modal]);

  // c) Cambiar de sección con el entrenamiento incompleto
  useEffect(() => {
    if (!active || progress.complete) return;
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setModal({ kind: 'leave', href: url.pathname + url.search });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, progress.complete]);

  // ------------------------------ Series ------------------------------
  function startRest(rex: Rex, n: number) {
    const secs = rex.rest_seconds ?? 90;
    if (secs <= 0) return;
    setRest({ endAt: Date.now() + secs * 1000, total: secs, label: `${rex.exercise.name}${n < rex.sets ? ` · serie ${n + 1} de ${rex.sets}` : ' · siguiente ejercicio'}` });
  }

  /** Guarda una operación (con la cola sin señal). Devuelve true si quedó guardada o encolada. */
  async function persist(op: PendingOp, k: string, sig: string) {
    const offline = !navigator.onLine;
    if (offline || readQueue().length) {
      saved.current[k] = sig;
      setQueued(enqueue(op));
      setState('offline');
      if (!offline) flush();
      return true;
    }
    const res = op.type === 'delete'
      ? await sb.from('set_logs').delete().match({ routine_exercise_id: op.routine_exercise_id, performed_on: op.performed_on, set_number: op.set_number })
      : op.type === 'upsert'
        ? await sb.from('set_logs').upsert(op.row, { onConflict: 'routine_exercise_id,performed_on,set_number' })
        : await sb.from('set_logs').update({ exercise_id: op.exercise_id }).match({ routine_exercise_id: op.routine_exercise_id, performed_on: op.performed_on });
    if (res.error && isNetworkError(res.error)) {
      saved.current[k] = sig;
      setQueued(enqueue(op));
      setState('offline');
      return true;
    }
    if (res.error) {
      setState('error');
      flash('No se pudo guardar: ' + res.error.message);
      return false;
    }
    saved.current[k] = sig;
    setState('saved');
    return true;
  }

  async function saveCell(rex: Rex, n: number) {
    const k = key(rex.id, n);
    if (k in skips) return;
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
    if (sig !== '|') void ensureSession(); // cargar la primera serie inicia el entrenamiento
    const exerciseId = chosen[rex.id] ?? rex.exercise_id;
    const row: SetRow = { student_id: studentId, routine_exercise_id: rex.id, exercise_id: exerciseId, performed_on: date, set_number: n, reps: reps == null ? null : Math.round(reps), weight, skipped: false, skip_reason: null };
    const op: PendingOp = reps == null && weight == null
      ? { k: setKey(rex.id, date, n), type: 'delete', routine_exercise_id: rex.id, performed_on: date, set_number: n }
      : { k: setKey(rex.id, date, n), type: 'upsert', row };
    if (repsChanged) startRest(rex, n);
    const ok = await persist(op, k, sig);
    if (ok && state !== 'offline' && navigator.onLine && reps != null && reps >= rex.rep_max) checkProgression(rex);
  }

  /** 2) Saltear series (o el ejercicio entero) con un motivo. */
  async function skipSets(rex: Rex, sets: number[], reason: string | null) {
    void ensureSession();
    const exerciseId = chosen[rex.id] ?? rex.exercise_id;
    setSkips((s) => ({ ...s, ...Object.fromEntries(sets.map((n) => [key(rex.id, n), reason])) }));
    setCells((c) => { const next = { ...c }; sets.forEach((n) => delete next[key(rex.id, n)]); return next; });
    for (const n of sets) {
      const row: SetRow = { student_id: studentId, routine_exercise_id: rex.id, exercise_id: exerciseId, performed_on: date, set_number: n, reps: null, weight: null, skipped: true, skip_reason: reason };
      await persist({ k: setKey(rex.id, date, n), type: 'upsert', row }, key(rex.id, n), 'skip');
    }
    flash(sets.length === 1 ? `Serie ${sets[0]} salteada` : `${rex.exercise.name}: ${sets.length} series salteadas`);
  }

  async function unskip(rex: Rex, n: number) {
    const k = key(rex.id, n);
    setSkips((s) => { const next = { ...s }; delete next[k]; return next; });
    await persist({ k: setKey(rex.id, date, n), type: 'delete', routine_exercise_id: rex.id, performed_on: date, set_number: n }, k, '|');
  }

  async function changeExercise(rex: Rex, exId: string) {
    setChosen((m) => ({ ...m, [rex.id]: exId }));
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

  const elapsed = session ? (session.ended_at ? new Date(session.ended_at).getTime() : now) - new Date(session.started_at).getTime() : 0;
  const pendingCount = progress.pending;

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
        </span>
      </div>

      {/* ------- Barra de la sesión ------- */}
      {active ? (
        <div className="session-bar active" role="status">
          <div className="grow">
            <span className="type">Entrenando</span>
            <div className="session-time">{fmtDuration(elapsed)}</div>
          </div>
          <div className="session-prog">
            <b>{progress.done + progress.skipped}/{progress.total}</b> series
            <div className="macro-track" aria-hidden="true"><i style={{ width: `${progress.total ? ((progress.done + progress.skipped) / progress.total) * 100 : 0}%` }} /></div>
          </div>
          <button className="btn sm" onClick={() => (progress.complete ? doFinish('completo') : setModal({ kind: 'finish' }))}>Finalizar</button>
        </div>
      ) : session?.ended_at ? (
        <div className="session-bar ended" role="status">
          <span className="grow">✓ Entrenamiento finalizado · <b>{fmtDuration(elapsed)}</b> · {session.done_sets}/{session.total_sets} series{session.skipped_sets ? ` · ${session.skipped_sets} salteadas` : ''}</span>
          {isToday && <button className="btn ghost sm" onClick={reopen}>Reabrir</button>}
        </div>
      ) : isToday && day.exercises.length > 0 ? (
        <button className="btn primary block session-start" onClick={start}>▶ Iniciar entrenamiento</button>
      ) : null}

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
        const todayWeights = Array.from({ length: rex.sets }, (_, i) => num(cells[key(rex.id, i + 1)]?.weight)).filter((w): w is number => w != null);
        const choosing = !isSwap && (rex.target_weight == null || (rex.target_source === 'student' && rex.target_set_on === date));
        const shownTarget = choosing ? (todayWeights.length ? Math.min(...todayWeights) : null) : rex.target_weight;
        const openSets = Array.from({ length: rex.sets }, (_, i) => i + 1).filter((n) => {
          const k = key(rex.id, n); const c = cells[k];
          return !(k in skips) && !(num(c?.reps) != null && num(c?.weight) != null);
        });
        const allSkipped = Array.from({ length: rex.sets }, (_, i) => key(rex.id, i + 1)).every((k) => k in skips);
        return (
          <section key={rex.id} className={`sheet ex-card ${allSkipped ? 'skipped-ex' : ''}`}>
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

            {rex.alternatives.length > 0 && !allSkipped && (
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
                  const p = prev.find((l) => l.set_number === n && !l.skipped);
                  if (k in skips) {
                    return (
                      <tr key={n} className="skipped">
                        <td className="n">{n}</td>
                        <td colSpan={2} className="skip-cell">Salteada{skips[k] ? ` · ${skips[k]}` : ''}</td>
                        <td className="ok"><button type="button" className="skip-btn" onClick={() => unskip(rex, n)} aria-label={`Deshacer saltear serie ${n}`} title="Deshacer">↺</button></td>
                      </tr>
                    );
                  }
                  const c = cells[k] ?? { reps: '', weight: '' };
                  const r = num(c.reps);
                  const top = r != null && r >= rex.rep_max;
                  const doneSet = r != null && num(c.weight) != null;
                  return (
                    <tr key={n} className={r != null ? 'done' : ''}>
                      <td className="n">{n}</td>
                      <td>
                        <input className="cell-in" inputMode="decimal" enterKeyHint="next" aria-label={`Peso serie ${n}`}
                          placeholder={rex.target_weight != null && !isSwap ? String(rex.target_weight) : p?.weight?.toString() ?? 'kg'}
                          value={c.weight} onFocus={(e) => { focusWeight(rex, n); selectAll(e.currentTarget); }} onChange={(e) => set(k, 'weight', e.target.value)} onBlur={() => saveCell(rex, n)} />
                        {p && <span className="prev">antes {setText(p.weight, p.reps)}</span>}
                      </td>
                      <td>
                        <input className="cell-in" inputMode="numeric" enterKeyHint="next" aria-label={`Repeticiones serie ${n}`}
                          placeholder={`${rex.rep_min}–${rex.rep_max}`} value={c.reps} onFocus={(e) => selectAll(e.currentTarget)}
                          onChange={(e) => set(k, 'reps', e.target.value.replace(/\D/g, ''))} onBlur={() => saveCell(rex, n)} />
                      </td>
                      <td className="ok">
                        {r != null ? (
                          <span className="check" style={top ? { color: 'var(--red)' } : !doneSet ? { color: 'var(--amber)' } : undefined} title={top ? 'Tope del rango' : !doneSet ? 'Falta el peso' : 'Hecha'}>
                            {top ? '★' : !doneSet ? '?' : <IconCheck size={26} />}
                          </span>
                        ) : (
                          <button type="button" className="skip-btn" onClick={() => setModal({ kind: 'skip', rex, sets: [n] })} aria-label={`Saltear serie ${n}`} title="Saltear serie">⤼</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="row between wrap" style={{ marginTop: 6 }}>
              {prevDate ? <p className="type muted" style={{ margin: 0 }}>“antes” = sesión del {fmtDate(prevDate)}</p> : <span />}
              {openSets.length > 0 && (
                <button type="button" className="btn ghost sm" onClick={() => setModal({ kind: 'skip', rex, sets: openSets })}>
                  {openSets.length === rex.sets ? 'Saltear ejercicio' : `Saltear las ${openSets.length} que faltan`}
                </button>
              )}
            </div>
          </section>
        );
      })}

      {!day.exercises.length && <div className="sheet empty">Este día todavía no tiene ejercicios.</div>}

      {active && !progress.complete && day.exercises.length > 0 && (
        <button className="btn block" onClick={() => setModal({ kind: 'finish' })}>Finalizar entrenamiento</button>
      )}

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

      {/* ------- Modales ------- */}
      {modal?.kind === 'skip' && (
        <SkipModal rex={modal.rex} sets={modal.sets} onClose={() => setModal(null)}
          onConfirm={(reason) => { const m = modal; setModal(null); skipSets(m.rex, m.sets, reason); }} />
      )}

      {modal?.kind === 'finish' && (
        <Modal title="¿Finalizar el entrenamiento?" onClose={() => setModal(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Todavía {pendingCount === 1 ? 'falta cargar 1 serie' : `faltan cargar ${pendingCount} series`}:</p>
            <PendingList progress={progress} />
            <p className="small muted" style={{ margin: 0 }}>Si finalizás, quedan como “sin cargar” y tu profe lo va a ver. Si no las hiciste a propósito, podés saltearlas con su motivo.</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => setModal(null)}>Seguir entrenando</button>
              <button className="btn danger" onClick={() => { setModal(null); doFinish('manual'); }}>Finalizar igual</button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.kind === 'leave' && (
        <Modal title="Tenés un entrenamiento en curso" onClose={() => setModal(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Llevás <b>{fmtDuration(elapsed)}</b> y {pendingCount === 1 ? 'falta 1 serie' : `faltan ${pendingCount} series`}. ¿Qué querés hacer?</p>
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn primary block" onClick={() => { const h = modal.href; setModal(null); leaving.current = true; router.push(h); }}>Ver otra sección (sigo entrenando)</button>
              <button className="btn danger block" onClick={() => { const h = modal.href; setModal(null); doFinish('manual', h); }}>Finalizar el entrenamiento</button>
              <button className="btn ghost block" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.kind === 'stale' && (
        <Modal title="¿Seguís entrenando? ⏱" onClose={() => setModal(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>Empezaste hace <b>{fmtDuration(elapsed)}</b> y el entrenamiento todavía no está finalizado.</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => setModal(null)}>Sigo entrenando</button>
              <button className="btn" onClick={() => { setModal(null); progress.complete ? doFinish('completo') : setModal({ kind: 'finish' }); }}>Ya terminé</button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.kind === 'summary' && (
        <Celebration
          title={modal.reason === 'completo' ? '¡Entrenamiento completo!' : 'Entrenamiento finalizado'}
          stamp={modal.reason === 'completo' ? '¡Bien ahí!' : 'Finalizado'}
          festive={modal.reason === 'completo' && modal.progress.skipped === 0}
          lines={[
            <span key="t">Duración: <b>{fmtDuration(modal.ms)}</b> · <b>{modal.progress.done}/{modal.progress.total}</b> series</span>,
            ...(modal.progress.skippedList.length ? [<span key="s" className="small">Salteaste: {modal.progress.skippedList.map((x) => `${x.exercise} (${x.sets.length})${x.reason ? ` · ${x.reason}` : ''}`).join('; ')}</span>] : []),
            ...(modal.progress.pendingList.length ? [<span key="p" className="small">Sin cargar: {modal.progress.pendingList.map((x) => `${x.exercise} (${x.sets.length})`).join('; ')}</span>] : []),
            ...(modal.progress.skipped || modal.progress.pending ? [<span key="n" className="muted small">Tu profe va a ver el resumen.</span>] : []),
          ]}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function PendingList({ progress }: { progress: Progress }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {progress.pendingList.map((x) => <li key={x.exercise}><b>{x.exercise}</b>: {x.sets.length === 1 ? `serie ${x.sets[0]}` : `series ${x.sets.join(', ')}`}</li>)}
    </ul>
  );
}

function SkipModal({ rex, sets, onClose, onConfirm }: { rex: Rex; sets: number[]; onClose: () => void; onConfirm: (reason: string | null) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const final = reason === 'Otro' ? (other.trim() || 'Otro') : reason;
  return (
    <Modal title={sets.length === 1 ? `Saltear la serie ${sets[0]}` : sets.length === rex.sets ? `Saltear ${rex.exercise.name}` : `Saltear ${sets.length} series`} onClose={onClose}>
      <div className="stack">
        <p style={{ margin: 0 }}>{rex.exercise.name}{sets.length > 1 ? ` · series ${sets.join(', ')}` : ''}. Tu profe lo va a ver al terminar el entrenamiento.</p>
        <span className="type">¿Por qué? (opcional)</span>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {SKIP_REASONS.map((r) => <button key={r} type="button" className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(reason === r ? null : r)}>{r}</button>)}
        </div>
        {reason === 'Otro' && <input className="input" style={{ fontSize: '1.25rem' }} autoFocus placeholder="Contale a tu profe" value={other} onChange={(e) => setOther(e.target.value)} />}
        <div className="row wrap">
          <button className="btn primary" onClick={() => onConfirm(final)}>Saltear</button>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
