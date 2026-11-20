import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { Profile } from './types';

/**
 * Usuario y perfil de la petición actual. `cache` hace que el layout y la página
 * compartan una sola verificación de sesión y una sola consulta del perfil.
 * getClaims verifica el token localmente cuando el proyecto usa claves asimétricas
 * (sin ida y vuelta al servidor de login).
 */
const currentUser = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { sb, me: null as Profile | null };
  const { data: me } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  return { sb, me: (me as Profile | null) ?? null };
});

export async function requireUser(role?: 'trainer' | 'student') {
  const { sb, me } = await currentUser();
  if (!me) redirect('/login');
  if (!me.active) redirect('/login?inactivo=1');
  if (role && me.role !== role) redirect(me.role === 'trainer' ? '/profe' : '/alumno');
  return { sb, me };
}
