import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import { getMe } from './data';

export async function requireUser(role?: 'trainer' | 'student') {
  const sb = await supabaseServer();
  const me = await getMe(sb);
  if (!me) redirect('/login');
  if (!me.active) redirect('/login?inactivo=1');
  if (role && me.role !== role) redirect(me.role === 'trainer' ? '/profe' : '/alumno');
  return { sb, me };
}
