'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { num } from '@/lib/utils';
import { createStudent } from '../actions';
import { LevelChips } from '@/components/LevelPicker';
import type { Level } from '@/lib/types';

function randomPass() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => a[n % a.length]).join('');
}

export default function NewStudent({ openInitially = false }: { openInitially?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [mode, setMode] = useState<'invite' | 'password'>('invite');
  const [level, setLevel] = useState<Level | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', age: '', password: randomPass() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const a = num(form.age);
    const res = await createStudent({ email: form.email, full_name: form.full_name, age: a == null ? null : Math.round(a), mode, password: form.password, level });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setDone({ id: res.id!, message: res.message ?? 'Listo' });
    router.refresh();
  }

  function close() {
    setOpen(false);
    setDone(null);
    setErr(null);
    setForm({ email: '', full_name: '', age: '', password: randomPass() });
    setLevel(null);
    router.replace('/profe/alumnos');
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Nuevo alumno</button>
      {open && (
        <Modal title="Nuevo alumno" onClose={close}>
          {done ? (
            <div className="stack-lg">
              <div className="postit green">{done.message}</div>
              {mode === 'password' && (
                <div className="sheet plain" style={{ background: 'var(--paper-2)' }}>
                  <span className="type">Datos de acceso</span>
                  <p className="ink" style={{ margin: '6px 0 0' }}>{form.email}<br />{form.password}</p>
                </div>
              )}
              <div className="row wrap">
                <button className="btn primary" onClick={() => router.push(`/profe/alumnos/${done.id}?nueva=1`)}>Armar su rutina →</button>
                <button className="btn" onClick={close}>Cerrar</button>
              </div>
            </div>
          ) : (
            <form className="stack-lg" onSubmit={submit}>
              <div className="field"><label htmlFor="sn">Nombre completo</label><input id="sn" className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="row" style={{ gap: 18, alignItems: 'flex-end' }}>
                <div className="field grow"><label htmlFor="se">Email</label><input id="se" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="field" style={{ width: 90 }}><label htmlFor="sa">Edad</label><input id="sa" className="input" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="type">Nivel (sólo lo ves vos, opcional)</span>
                <LevelChips value={level} onChange={setLevel} />
              </div>
              <fieldset className="stack" style={{ border: '1.5px dashed var(--line)', borderRadius: 8, padding: 12 }}>
                <legend className="type">¿Cómo le damos acceso?</legend>
                <label className="checkbox"><input type="radio" name="mode" checked={mode === 'invite'} onChange={() => setMode('invite')} /> Mandarle una invitación por mail para que elija su contraseña</label>
                <label className="checkbox"><input type="radio" name="mode" checked={mode === 'password'} onChange={() => setMode('password')} /> Crear con contraseña temporal (se la paso yo)</label>
                {mode === 'password' && (
                  <div className="field"><label htmlFor="sp">Contraseña temporal</label><input id="sp" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                )}
              </fieldset>
              {err && <p className="notice red">{err}</p>}
              <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Dar de alta'}</button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
