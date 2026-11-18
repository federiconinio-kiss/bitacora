'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function NewPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p1.length < 8) return setError('Usá al menos 8 caracteres.');
    if (p1 !== p2) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace('/');
    router.refresh();
  }

  if (hasSession === false)
    return (
      <AuthCard title="Link vencido">
        <p>Para crear una contraseña nueva necesitás abrir el link que te llegó por mail.</p>
        <Link href="/recuperar" className="btn block">Pedir un link nuevo</Link>
      </AuthCard>
    );

  return (
    <AuthCard title="Elegí tu contraseña" subtitle="La vas a usar junto con tu email para entrar.">
      <form onSubmit={submit} className="stack-lg">
        <div className="field">
          <label htmlFor="p1">Contraseña nueva</label>
          <input id="p1" className="input" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p2">Repetila</label>
          <input id="p2" className="input" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
        </div>
        {error && <p className="notice red">{error}</p>}
        <button className="btn primary block" disabled={busy || hasSession === null}>{busy ? <span className="spinner" /> : 'Guardar y entrar'}</button>
      </form>
    </AuthCard>
  );
}
