'use client';
import { useState } from 'react';
import Link from 'next/link';
import AuthCard from '@/components/AuthCard';
import { createClient } from '@supabase/supabase-js';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    // Flujo "implicit" (sin PKCE): el link del mail funciona aunque se abra en otro dispositivo.
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/auth/nueva-clave`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te mandamos un link por mail para crear una nueva.">
      {sent ? (
        <div className="stack">
          <div className="postit">Listo. Revisá tu mail (y la carpeta de spam) y seguí el link.</div>
          <Link href="/login" className="btn block" style={{ marginTop: 16 }}>Volver a entrar</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="stack-lg">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@mail.com" />
          </div>
          {error && <p className="notice red">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Enviarme el link'}</button>
          <p className="small" style={{ textAlign: 'center', margin: 0 }}><Link href="/login">Volver</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
