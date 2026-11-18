'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('inactivo') ? 'Tu acceso está pausado. Hablá con tu profe.' : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message.includes('Invalid') ? 'Email o contraseña incorrectos.' : error.message);
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack-lg">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@mail.com" />
      </div>
      <div className="field">
        <label htmlFor="pass">Contraseña</label>
        <input id="pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="notice red" role="alert">{error}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Entrar'}</button>
      <p className="small" style={{ textAlign: 'center', margin: 0 }}>
        <Link href="/recuperar">¿Te olvidaste la contraseña?</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard title="¡Hola de nuevo!" subtitle="Entrá a tu planilla de entrenamiento.">
      <Suspense><LoginForm /></Suspense>
    </AuthCard>
  );
}
