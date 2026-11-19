'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FullRoutine, Measurement, Profile, SetLog, TrainingInfo } from '@/lib/types';
import TrainingInfoForm, { levelLabel } from '@/components/LevelPicker';
import { supabaseBrowser } from '@/lib/supabase/client';
import { daysBetween, fmtDate, initials, num, todayISO } from '@/lib/utils';
import { duplicateRoutine } from '@/lib/routineOps';
import { MeasurementsHistory, TrainingHistory } from '@/components/History';
import { IconBack } from '@/components/Icons';
import { deleteStudent, sendAccessEmail, setStudentActive, setTempPassword } from '../../actions';

type Tab = 'rutinas' | 'historial' | 'datos';

export default function StudentDetail({ student, routines, logs, measurements, initialTab, trainingInfo }: {
  student: Profile; routines: FullRoutine[]; logs: SetLog[]; measurements: Measurement[]; initialTab: Tab; trainingInfo: TrainingInfo | null;
}) {
  const [level, setLevel] = useState(trainingInfo?.level ?? null);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const lastLog = logs.length ? logs[logs.length - 1].performed_on : null;
  const lastMeas = measurements.length ? measurements[measurements.length - 1] : null;

  async function newRoutine() {
    setBusy(true);
    const { data, error } = await supabaseBrowser()
      .from('routines')
      .insert({ student_id: student.id, name: `Rutina ${routines.length + 1}`, goal: routines[0]?.goal ?? '' })
      .select('id').single();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    router.push(`/profe/rutinas/${data.id}`);
  }

  async function duplicate(r: FullRoutine) {
    setBusy(true);
    try {
      const id = await duplicateRoutine(supabaseBrowser(), r);
      router.push(`/profe/rutinas/${id}`);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  }

  async function run(p: Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.message ?? 'Listo.' } : { ok: false, text: r.error ?? 'Error' });
    router.refresh();
  }

  return (
    <div className="stack-lg">
      <div className="row">
        <Link href="/profe/alumnos" className="icon-btn" aria-label="Volver"><IconBack /></Link>
        <span className="avatar" style={{ width: 54, height: 54, fontSize: '1.7rem' }}>{initials(student.full_name, student.email[0]?.toUpperCase())}</span>
        <div className="grow">
          <h1 className="h-hand">{student.full_name || student.email}</h1>
          <p className="type" style={{ margin: 0 }}>
            {student.age ? `${student.age} años · ` : ''}{lastMeas?.weight ? `${lastMeas.weight} kg · ` : ''}
            {lastLog ? `entrenó ${daysBetween(lastLog, todayISO()) === 0 ? 'hoy' : `hace ${daysBetween(lastLog, todayISO())} días`}` : 'sin entrenamientos'}
            {!student.active && ' · pausado'}
          </p>
          <button className={`tag ${level ? 'ink' : 'amber'}`} style={{ marginTop: 4, cursor: 'pointer', background: 'none' }} onClick={() => setTab('datos')}>
            {level ? levelLabel(level) : 'Cargar nivel'}
          </button>
        </div>
      </div>

      <div className="chips" role="tablist">
        {(['rutinas', 'historial', 'datos'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t === 'rutinas' ? 'Rutinas' : t === 'historial' ? 'Historial y medidas' : 'Datos y acceso'}
          </button>
        ))}
      </div>
      {msg && <p className={`notice ${msg.ok ? 'green' : 'red'}`}>{msg.text}</p>}

      {tab === 'rutinas' && (
        <div className="stack">
          <div className="row wrap">
            <button className="btn primary" disabled={busy} onClick={newRoutine}>+ Nueva rutina</button>
          </div>
          {routines.length === 0 && <div className="sheet empty"><p className="ink">Todavía no tiene rutinas.</p></div>}
          <div className="grid-2">
            {routines.map((r, i) => (
              <article key={r.id} className={`sheet ${i % 2 ? 'tilt-r' : 'tilt-l'}`}>
                <div className="row between wrap">
                  <h2 className="h-hand">{r.name}</h2>
                  {r.published ? <span className="stamp green" style={{ fontSize: '.8rem' }}>Publicada</span> : <span className="tag amber">borrador</span>}
                </div>
                <p className="type" style={{ margin: '4px 0' }}>Desde {fmtDate(r.start_date, { day: 'numeric', month: 'short', year: 'numeric' })} · {r.days.length} días · {r.days.reduce((s, d) => s + d.exercises.length, 0)} ejercicios</p>
                {r.goal && <p className="ink" style={{ fontSize: '1.35rem', margin: '6px 0' }}>{r.goal}</p>}
                <p className="small muted" style={{ margin: 0 }}>{r.days.map((d) => d.title).join(' · ')}</p>
                <div className="row wrap" style={{ marginTop: 12 }}>
                  <Link className="btn sm primary" href={`/profe/rutinas/${r.id}`}>Editar</Link>
                  <button className="btn sm" disabled={busy} onClick={() => duplicate(r)}>Duplicar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'historial' && <TrainerHistory routines={routines} logs={logs} measurements={measurements} />}

      {tab === 'datos' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="stack-lg">
            <TrainingInfoForm studentId={student.id} initial={trainingInfo} onSaved={(i) => setLevel(i.level)} />
            <EditStudent student={student} onSaved={(t) => { setMsg({ ok: true, text: t }); router.refresh(); }} />
          </div>
          <section className="sheet plain stack">
            <h2 className="h-hand">Acceso</h2>
            <p className="type" style={{ margin: 0 }}>{student.email}</p>
            <button className="btn" disabled={busy} onClick={() => run(sendAccessEmail(student.id))}>Enviar mail para (re)crear contraseña</button>
            <TempPassword disabled={busy} onSet={(p) => run(setTempPassword(student.id, p))} />
            <hr style={{ border: 0, borderTop: '1.5px dashed var(--line)', width: '100%' }} />
            {student.active ? (
              <button className="btn danger" disabled={busy} onClick={() => confirm('¿Pausar el acceso? No va a poder entrar hasta que lo reactives.') && run(setStudentActive(student.id, false))}>Pausar acceso</button>
            ) : (
              <button className="btn green" disabled={busy} onClick={() => run(setStudentActive(student.id, true))}>Reactivar acceso</button>
            )}
            <button className="btn ghost" style={{ color: 'var(--red)' }} disabled={busy}
              onClick={async () => {
                if (!confirm(`¿Eliminar a ${student.full_name || student.email} y TODO su historial? No se puede deshacer.`)) return;
                setBusy(true);
                const r = await deleteStudent(student.id);
                if (r.ok) router.push('/profe/alumnos');
                else { setBusy(false); setMsg({ ok: false, text: r.error }); }
              }}>
              Eliminar alumno
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function TrainerHistory({ routines, logs, measurements }: { routines: FullRoutine[]; logs: SetLog[]; measurements: Measurement[] }) {
  const [rid, setRid] = useState(routines.find((r) => r.published)?.id ?? routines[0]?.id ?? '');
  const [tab, setTab] = useState<'ent' | 'med'>('ent');
  const routine = routines.find((r) => r.id === rid);
  return (
    <div className="stack-lg">
      <div className="row wrap">
        <div className="chips">
          <button className={`chip ${tab === 'ent' ? 'on' : ''}`} onClick={() => setTab('ent')}>Entrenamiento (semanal)</button>
          <button className={`chip ${tab === 'med' ? 'on' : ''}`} onClick={() => setTab('med')}>Medidas (cada 2 semanas)</button>
        </div>
        {tab === 'ent' && routines.length > 1 && (
          <select className="select" style={{ width: 'auto', fontSize: '1.25rem' }} value={rid} onChange={(e) => setRid(e.target.value)} aria-label="Rutina">
            {routines.map((r) => <option key={r.id} value={r.id}>{r.name} ({fmtDate(r.start_date)})</option>)}
          </select>
        )}
        <span className="tag ink">sólo lectura</span>
      </div>
      {tab === 'ent' ? (routine ? <TrainingHistory routine={routine} logs={logs} /> : <div className="sheet plain empty">Sin rutinas.</div>) : <MeasurementsHistory items={measurements} />}
    </div>
  );
}

function EditStudent({ student, onSaved }: { student: Profile; onSaved: (t: string) => void }) {
  const [name, setName] = useState(student.full_name);
  const [age, setAge] = useState(student.age?.toString() ?? '');
  const [phone, setPhone] = useState(student.phone ?? '');
  const [err, setErr] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const a = num(age);
    const { error } = await supabaseBrowser().from('profiles').update({ full_name: name.trim(), age: a == null ? null : Math.round(a), phone: phone.trim() || null }).eq('id', student.id);
    if (error) setErr(error.message);
    else onSaved('Datos actualizados.');
  }
  return (
    <form className="sheet stack-lg" onSubmit={save}>
      <span className="tape" />
      <h2 className="h-hand">Datos personales</h2>
      <div className="field"><label htmlFor="en">Nombre completo</label><input id="en" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="row" style={{ gap: 18 }}>
        <div className="field" style={{ width: 90 }}><label htmlFor="ea">Edad</label><input id="ea" className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
        <div className="field grow"><label htmlFor="ep">Teléfono</label><input id="ep" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      {err && <p className="notice red">{err}</p>}
      <button className="btn primary">Guardar</button>
    </form>
  );
}

function TempPassword({ onSet, disabled }: { onSet: (p: string) => void; disabled: boolean }) {
  const [p, setP] = useState('');
  return (
    <div className="row wrap" style={{ alignItems: 'flex-end' }}>
      <div className="field grow"><label htmlFor="tp">O fijar contraseña temporal</label><input id="tp" className="input" value={p} onChange={(e) => setP(e.target.value)} placeholder="mín. 8 caracteres" /></div>
      <button className="btn sm" disabled={disabled || p.length < 8} onClick={() => { onSet(p); setP(''); }}>Fijar</button>
    </div>
  );
}
