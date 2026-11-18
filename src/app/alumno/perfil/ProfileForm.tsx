'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { num } from '@/lib/utils';

export default function ProfileForm({ me }: { me: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(me.full_name);
  const [age, setAge] = useState(me.age?.toString() ?? '');
  const [phone, setPhone] = useState(me.phone ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const a = num(age);
    const { error } = await supabaseBrowser().from('profiles').update({ full_name: name.trim(), age: a == null ? null : Math.round(a), phone: phone.trim() || null }).eq('id', me.id);
    setBusy(false);
    setMsg(error ? { ok: false, text: 'No se pudo guardar: ' + error.message } : { ok: true, text: 'Datos guardados.' });
    if (!error) router.refresh();
  }

  return (
    <form className="sheet tilt-r" onSubmit={save}>
      <span className="tape" />
      <h2 className="h-hand" style={{ marginBottom: 12 }}>Mis datos</h2>
      <div className="stack-lg">
        <div className="field"><label htmlFor="n">Nombre completo</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="row" style={{ gap: 18, alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 110 }}><label htmlFor="a">Edad</label><input id="a" className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
          <div className="field grow"><label htmlFor="p">Teléfono</label><input id="p" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="field"><label>Email</label><span className="ink" style={{ fontSize: '1.3rem', padding: '6px 2px' }}>{me.email}</span></div>
        {msg && <p className={`notice ${msg.ok ? 'green' : 'red'}`}>{msg.text}</p>}
        <div className="row wrap">
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Guardar'}</button>
          <Link className="btn ghost" href="/auth/nueva-clave">Cambiar contraseña</Link>
        </div>
      </div>
    </form>
  );
}
