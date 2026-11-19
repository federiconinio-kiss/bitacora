'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Exercise, FullRoutine } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { DAYS, fmtDate, num } from '@/lib/utils';
import ExercisePicker from '@/components/ExercisePicker';
import VideoButton from '@/components/VideoButton';
import { IconBack, IconDown, IconPlus, IconSwap, IconTrash, IconUp, IconX } from '@/components/Icons';
import type { Profile, RoutineReview, TrainingInfo } from '@/lib/types';
import AiReview from './AiReview';
import { notify } from '@/lib/notify';

type Day = FullRoutine['days'][number];
type Rex = Day['exercises'][number];
type PickerState =
  | { kind: 'add'; dayId: string }
  | { kind: 'replace'; dayId: string; rex: Rex }
  | { kind: 'alt'; dayId: string; rex: Rex }
  | null;

const TEMPLATES: { label: string; days: { title: string; dow: number }[] }[] = [
  { label: 'Torso / Piernas (4 días)', days: [{ title: 'Torso A', dow: 1 }, { title: 'Piernas A', dow: 2 }, { title: 'Torso B', dow: 4 }, { title: 'Piernas B', dow: 5 }] },
  { label: 'Tren superior / inferior (2 días)', days: [{ title: 'Tren superior', dow: 1 }, { title: 'Tren inferior', dow: 4 }] },
  { label: 'Full body (3 días)', days: [{ title: 'Full body A', dow: 1 }, { title: 'Full body B', dow: 3 }, { title: 'Full body C', dow: 5 }] },
  { label: 'Push / Pull / Legs', days: [{ title: 'Empuje', dow: 1 }, { title: 'Tracción', dow: 3 }, { title: 'Piernas', dow: 5 }] },
];

export default function RoutineBuilder({ initial, student, exercises: initialEx, trainingInfo, reviews }: { initial: FullRoutine; student: Profile; exercises: Exercise[]; trainingInfo: TrainingInfo | null; reviews: RoutineReview[] }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [r, setR] = useState<FullRoutine>(initial);
  const [exercises, setExercises] = useState(initialEx);
  const [picker, setPicker] = useState<PickerState>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ok = (m = 'Guardado') => { setStatus(m); setErr(null); setTimeout(() => setStatus(null), 1600); };
  const fail = (e: { message: string } | null) => { if (e) { setErr(e.message); return true; } return false; };
  const patchDay = (dayId: string, fn: (d: Day) => Day) => setR((x) => ({ ...x, days: x.days.map((d) => (d.id === dayId ? fn(d) : d)) }));
  const patchRex = (dayId: string, rexId: string, fn: (e: Rex) => Rex) => patchDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === rexId ? fn(e) : e)) }));

  async function saveRoutine(fields: Partial<FullRoutine>) {
    setR((x) => ({ ...x, ...fields }));
    const { error } = await sb.from('routines').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', r.id);
    if (!fail(error)) ok();
  }

  async function publish(p: boolean) {
    if (p && !r.days.some((d) => d.exercises.length)) return setErr('Agregá al menos un ejercicio antes de publicar.');
    if (p) {
      // Una sola rutina vigente por alumno: las demás pasan a borrador.
      const { error } = await sb.from('routines').update({ published: false }).eq('student_id', r.student_id).neq('id', r.id);
      if (fail(error)) return;
    }
    await saveRoutine({ published: p });
    if (p) notify('routine_published', r.id);
    ok(p ? '¡Publicada! El alumno ya la ve.' : 'Pasó a borrador');
    router.refresh();
  }

  async function addDay(title = `Día ${r.days.length + 1}`, dow: number | null = null, position = r.days.length) {
    const { data, error } = await sb.from('routine_days').insert({ routine_id: r.id, title, day_of_week: dow, position }).select('*').single();
    if (fail(error)) return;
    setR((x) => ({ ...x, days: [...x.days, { ...data, exercises: [] }] }));
  }

  async function applyTemplate(i: number) {
    for (const [k, d] of TEMPLATES[i].days.entries()) await addDay(d.title, d.dow, k);
    ok('Días creados');
  }

  async function saveDay(d: Day, fields: Partial<Day>) {
    patchDay(d.id, (x) => ({ ...x, ...fields }));
    const { error } = await sb.from('routine_days').update(fields).eq('id', d.id);
    if (!fail(error)) ok();
  }

  async function removeDay(d: Day) {
    if (!confirm(`¿Borrar el día “${d.title}”${d.exercises.length ? ' y sus ejercicios (con su historial)' : ''}?`)) return;
    const { error } = await sb.from('routine_days').delete().eq('id', d.id);
    if (fail(error)) return;
    setR((x) => ({ ...x, days: x.days.filter((y) => y.id !== d.id) }));
  }

  async function moveDay(i: number, dir: -1 | 1) {
    const days = [...r.days];
    const j = i + dir;
    if (j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    setR((x) => ({ ...x, days: days.map((d, k) => ({ ...d, position: k })) }));
    await Promise.all(days.map((d, k) => sb.from('routine_days').update({ position: k }).eq('id', d.id)));
  }

  async function addExercise(dayId: string, ex: Exercise) {
    const day = r.days.find((d) => d.id === dayId)!;
    const prev = day.exercises[day.exercises.length - 1];
    const defaults = /Hombros|Bíceps|Tríceps|Gemelos|Abdomen/.test(ex.muscle_group) ? { sets: 3, rep_min: 10, rep_max: 15 } : { sets: 3, rep_min: 8, rep_max: 12 };
    const { data, error } = await sb.from('routine_exercises').insert({
      day_id: dayId, exercise_id: ex.id, position: (prev?.position ?? -1) + 1, ...defaults, rest_seconds: 90,
    }).select('*').single();
    if (fail(error)) return;
    patchDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, { ...data, exercise: ex, alternatives: [] }] }));
    ok('Ejercicio agregado');
  }

  async function replaceExercise(dayId: string, rex: Rex, ex: Exercise) {
    const { error } = await sb.from('routine_exercises').update({ exercise_id: ex.id }).eq('id', rex.id);
    if (fail(error)) return;
    patchRex(dayId, rex.id, (e) => ({ ...e, exercise_id: ex.id, exercise: ex, alternatives: e.alternatives.filter((a) => a.id !== ex.id) }));
    ok('Ejercicio cambiado');
  }

  async function addAlternative(dayId: string, rex: Rex, ex: Exercise) {
    const { error } = await sb.from('routine_exercise_alternatives').insert({ routine_exercise_id: rex.id, exercise_id: ex.id });
    if (fail(error)) return;
    patchRex(dayId, rex.id, (e) => ({ ...e, alternatives: [...e.alternatives, ex] }));
    ok('Opción de reemplazo agregada');
  }

  async function removeAlternative(dayId: string, rex: Rex, exId: string) {
    const { error } = await sb.from('routine_exercise_alternatives').delete().match({ routine_exercise_id: rex.id, exercise_id: exId });
    if (fail(error)) return;
    patchRex(dayId, rex.id, (e) => ({ ...e, alternatives: e.alternatives.filter((a) => a.id !== exId) }));
  }

  async function saveRex(dayId: string, rex: Rex, fields: Partial<Rex>) {
    const next = { ...rex, ...fields };
    if (next.rep_max < next.rep_min) return setErr('El tope del rango no puede ser menor al piso.');
    patchRex(dayId, rex.id, () => next);
    const { error } = await sb.from('routine_exercises').update(fields).eq('id', rex.id);
    if (!fail(error)) ok();
  }

  async function removeRex(dayId: string, rex: Rex) {
    if (!confirm(`¿Quitar ${rex.exercise.name}? Se borra también su registro de series.`)) return;
    const { error } = await sb.from('routine_exercises').delete().eq('id', rex.id);
    if (fail(error)) return;
    patchDay(dayId, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== rex.id) }));
  }

  async function moveRex(dayId: string, i: number, dir: -1 | 1) {
    const day = r.days.find((d) => d.id === dayId)!;
    const list = [...day.exercises];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patchDay(dayId, (d) => ({ ...d, exercises: list.map((e, k) => ({ ...e, position: k })) }));
    await Promise.all(list.map((e, k) => sb.from('routine_exercises').update({ position: k }).eq('id', e.id)));
  }

  function onPicked(ex: Exercise) {
    if (!picker) return;
    if (picker.kind === 'add') addExercise(picker.dayId, ex);
    if (picker.kind === 'replace') replaceExercise(picker.dayId, picker.rex, ex);
    if (picker.kind === 'alt') addAlternative(picker.dayId, picker.rex, ex);
    setPicker(null);
  }

  return (
    <div className="stack-lg">
      <div className="row wrap">
        <Link href={`/profe/alumnos/${student.id}`} className="icon-btn" aria-label="Volver"><IconBack /></Link>
        <div className="grow">
          <p className="type" style={{ margin: 0 }}>Rutina de {student.full_name || student.email}</p>
          <h1 className="h-hand">{r.name}</h1>
        </div>
        <span className="type" aria-live="polite">{status}</span>
        {r.published ? (
          <>
            <span className="stamp green">Publicada</span>
            <button className="btn sm" onClick={() => publish(false)}>Pasar a borrador</button>
          </>
        ) : (
          <>
            <a className="btn sm" href="#revision">Revisar con IA ↓</a>
            <button className="btn green" onClick={() => publish(true)}>Publicar para el alumno</button>
          </>
        )}
      </div>
      {err && <p className="notice red" role="alert">{err} <button className="btn ghost sm" onClick={() => setErr(null)}>ok</button></p>}

      <section className="sheet tilt-l">
        <span className="tape" />
        <div className="grid-2">
          <div className="stack-lg">
            <div className="field"><label htmlFor="rn">Nombre de la rutina</label>
              <input id="rn" className="input" defaultValue={r.name} onBlur={(e) => e.target.value !== r.name && saveRoutine({ name: e.target.value })} /></div>
            <div className="field" style={{ maxWidth: 220 }}><label htmlFor="rd">Arranca el</label>
              <input id="rd" type="date" className="input" defaultValue={r.start_date} onBlur={(e) => e.target.value && e.target.value !== r.start_date && saveRoutine({ start_date: e.target.value })} /></div>
          </div>
          <div className="stack-lg">
            <div className="field"><label htmlFor="rg">Objetivo (lo ve el alumno)</label>
              <textarea id="rg" className="textarea" defaultValue={r.goal} placeholder="Ej: subir 2 kg de músculo y bajar 2 kg de grasa para enero" onBlur={(e) => e.target.value !== r.goal && saveRoutine({ goal: e.target.value })} /></div>
            <div className="field"><label htmlFor="rno">Indicaciones generales</label>
              <textarea id="rno" className="textarea" defaultValue={r.notes} placeholder="Calentamiento, descansos, RIR, cardio…" onBlur={(e) => e.target.value !== r.notes && saveRoutine({ notes: e.target.value })} /></div>
          </div>
        </div>
      </section>

      {r.days.length === 0 && (
        <div className="sheet plain stack">
          <h2 className="h-hand">Empezá por los días</h2>
          <p className="muted" style={{ margin: 0 }}>Usá una plantilla o creá los días a mano.</p>
          <div className="row wrap">
            {TEMPLATES.map((t, i) => <button key={t.label} className="btn sm" onClick={() => applyTemplate(i)}>{t.label}</button>)}
          </div>
        </div>
      )}

      {r.days.map((d, di) => (
        <section key={d.id} className="sheet">
          <span className="punch" style={{ top: 28 }} />
          <div className="row wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field grow" style={{ minWidth: 180 }}>
              <label htmlFor={`dt-${d.id}`}>Día {di + 1}</label>
              <input id={`dt-${d.id}`} className="input" style={{ fontSize: '1.9rem', fontWeight: 700 }} defaultValue={d.title} onBlur={(e) => e.target.value !== d.title && saveDay(d, { title: e.target.value })} />
            </div>
            <div className="field" style={{ width: 150 }}>
              <label htmlFor={`dw-${d.id}`}>Día de la semana</label>
              <select id={`dw-${d.id}`} className="select" value={d.day_of_week ?? ''} onChange={(e) => saveDay(d, { day_of_week: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Libre</option>
                {DAYS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
              </select>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="icon-btn" onClick={() => moveDay(di, -1)} aria-label="Subir día"><IconUp size={18} /></button>
              <button className="icon-btn" onClick={() => moveDay(di, 1)} aria-label="Bajar día"><IconDown size={18} /></button>
              <button className="icon-btn" onClick={() => removeDay(d)} aria-label="Borrar día" style={{ color: 'var(--red)' }}><IconTrash size={18} /></button>
            </div>
          </div>

          <div className="stack" style={{ marginTop: 14 }}>
            {d.exercises.map((e, ei) => (
              <div key={e.id} style={{ borderTop: '1.5px solid var(--graphite)', paddingTop: 10 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="ex-num">{ei + 1}.</span>
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div className="ex-title" style={{ fontSize: '1.5rem' }}>{e.exercise.name}</div>
                    <span className="type">{e.exercise.muscle_group} · {e.exercise.equipment}</span>
                  </div>
                  <VideoButton exercise={e.exercise} label="" />
                  <button className="btn sm" onClick={() => setPicker({ kind: 'replace', dayId: d.id, rex: e })}><IconSwap size={18} /> Cambiar</button>
                  <button className="icon-btn" onClick={() => moveRex(d.id, ei, -1)} aria-label="Subir"><IconUp size={18} /></button>
                  <button className="icon-btn" onClick={() => moveRex(d.id, ei, 1)} aria-label="Bajar"><IconDown size={18} /></button>
                  <button className="icon-btn" onClick={() => removeRex(d.id, e)} aria-label="Quitar" style={{ color: 'var(--red)' }}><IconTrash size={18} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '8px 14px', marginTop: 8 }}>
                  <NumField label="Series" value={e.sets} onSave={(v) => v && saveRex(d.id, e, { sets: Math.max(1, Math.min(12, Math.round(v))) })} />
                  <NumField label="Reps mín" value={e.rep_min} onSave={(v) => v && saveRex(d.id, e, { rep_min: Math.round(v) })} />
                  <NumField label="Reps máx" value={e.rep_max} onSave={(v) => v && saveRex(d.id, e, { rep_max: Math.round(v) })} />
                  <NumField label="Carga (kg)" value={e.target_weight} allowEmpty placeholder="a elegir"
                    onSave={(v) => saveRex(d.id, e, { target_weight: v, target_source: 'trainer', target_set_on: null })} />
                  <NumField label="Pausa (seg)" value={e.rest_seconds} allowEmpty onSave={(v) => saveRex(d.id, e, { rest_seconds: v == null ? null : Math.round(v) })} />
                </div>
                {e.target_weight == null ? (
                  <p className="type" style={{ margin: '4px 0 0', color: 'var(--amber)' }}>Sin carga: el alumno la define en su primera sesión.</p>
                ) : e.target_source === 'student' ? (
                  <p className="type" style={{ margin: '4px 0 0', color: 'var(--amber)' }}>Carga inicial elegida por el alumno{e.target_set_on ? ` el ${fmtDate(e.target_set_on)}` : ''}. Si la cambiás, queda la tuya.</p>
                ) : null}
                <input className="input" style={{ fontSize: '1.25rem', marginTop: 6 }} placeholder="Nota técnica para el alumno (opcional)" defaultValue={e.notes}
                  onBlur={(ev) => ev.target.value !== e.notes && saveRex(d.id, e, { notes: ev.target.value })} />
                <div className="swap">
                  <div className="row wrap" style={{ gap: 6 }}>
                    <IconSwap size={18} /><span className="type">Si está ocupado, puede hacer:</span>
                    {e.alternatives.map((a) => (
                      <span key={a.id} className="chip" style={{ cursor: 'default' }}>
                        {a.name}
                        <button onClick={() => removeAlternative(d.id, e, a.id)} aria-label={`Quitar ${a.name}`} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><IconX size={14} /></button>
                      </span>
                    ))}
                    <button className="btn sm" onClick={() => setPicker({ kind: 'alt', dayId: d.id, rex: e })}><IconPlus size={16} /> opción</button>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn" style={{ borderStyle: 'dashed', boxShadow: 'none' }} onClick={() => setPicker({ kind: 'add', dayId: d.id })}>
              <IconPlus /> Agregar ejercicio
            </button>
          </div>
        </section>
      ))}

      <button className="btn" onClick={() => addDay()}><IconPlus /> Agregar día</button>

      <AiReview
        routineId={r.id}
        studentId={student.id}
        studentName={student.full_name || student.email}
        goal={r.goal}
        initialLevel={trainingInfo?.level ?? null}
        initialReviews={reviews}
      />

      {picker && (
        <ExercisePicker
          exercises={exercises}
          title={picker.kind === 'add' ? 'Agregar ejercicio' : picker.kind === 'replace' ? `Cambiar ${picker.rex.exercise.name}` : `Opción para ${picker.rex.exercise.name}`}
          initialGroup={picker.kind === 'add' ? null : picker.rex.exercise.muscle_group}
          exclude={picker.kind === 'add' ? [] : [picker.rex.exercise_id, ...picker.rex.alternatives.map((a) => a.id)]}
          onPick={onPicked}
          onCreated={(ex) => setExercises((l) => [...l, ex])}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function NumField({ label, value, onSave, allowEmpty, placeholder }: { label: string; value: number | null; onSave: (v: number | null) => void; allowEmpty?: boolean; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" inputMode="decimal" defaultValue={value ?? ''} placeholder={placeholder ?? (allowEmpty ? '—' : '')}
        onBlur={(e) => {
          const v = num(e.target.value);
          if (v === (value == null ? null : Number(value))) return;
          if (v == null && !allowEmpty) { e.target.value = String(value ?? ''); return; }
          onSave(v);
        }} />
    </div>
  );
}
