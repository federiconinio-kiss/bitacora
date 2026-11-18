'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import AuthCard from '@/components/AuthCard';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Procesa los links de los mails (invitación, recuperación): ?code, ?token_hash o #access_token. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const type = (params.get('type') || hash.get('type')) as EmailOtpType | null;
    const next =
      params.get('next') || (type === 'invite' || type === 'recovery' ? '/auth/nueva-clave' : '/');
    const err = params.get('error_description') || hash.get('error_description');

    (async () => {
      if (err) throw new Error(err);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const access = hash.get('access_token');
      const refresh = hash.get('refresh_token');
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (tokenHash && type) {
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      } else if (access && refresh) {
        const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
        if (error) throw error;
      } else {
        const { data } = await sb.auth.getSession();
        if (!data.session) throw new Error('El link no es válido.');
      }
      router.replace(next.startsWith('/') ? next : '/');
    })().catch((e: Error) =>
      setError(
        /expired|invalid/i.test(e.message)
          ? 'El link venció o ya fue usado. Pedí uno nuevo.'
          : e.message,
      ),
    );
  }, [params, router]);

  if (error)
    return (
      <div className="stack">
        <p className="notice red">{error}</p>
        <Link className="btn block" href="/recuperar">Pedir un link nuevo</Link>
      </div>
    );
  return <p className="row"><span className="spinner" /> Verificando el link…</p>;
}

export default function CallbackPage() {
  return (
    <AuthCard title="Un segundo…">
      <Suspense><Callback /></Suspense>
    </AuthCard>
  );
}
