'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

async function ownStudent(studentId: string) {
  const { sb, me } = await requireUser('trainer');
  const { data } = await sb.from('profiles').select('id,email,trainer_id').eq('id', studentId).maybeSingle();
  if (!data || data.trainer_id !== me.id) throw new Error('Alumno no encontrado');
  return { sb, me, student: data as { id: string; email: string } };
}

function friendly(msg: string) {
  if (/already been registered|already registered|exists/i.test(msg)) return 'Ya existe un usuario con ese email.';
  if (/rate limit/i.test(msg)) return 'Se alcanzó el límite de mails por hora. Configurá un SMTP propio (ver README) o usá “contraseña temporal”.';
  return msg;
}

export async function createStudent(input: { email: string; full_name: string; age: number | null; mode: 'invite' | 'password'; password?: string; level?: 'principiante' | 'intermedio' | 'avanzado' | null }): Promise<Result> {
  try {
    const { me } = await requireUser('trainer');
    const admin = supabaseAdmin();
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Email inválido.' };
    const app_metadata = { role: 'student', trainer_id: me.id };
    let userId: string;

    if (input.mode === 'password') {
      if (!input.password || input.password.length < 8) return { ok: false, error: 'La contraseña temporal debe tener al menos 8 caracteres.' };
      const { data, error } = await admin.auth.admin.createUser({
        email, password: input.password, email_confirm: true, app_metadata, user_metadata: { full_name: input.full_name },
      });
      if (error) return { ok: false, error: friendly(error.message) };
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: input.full_name },
        redirectTo: `${await siteUrl()}/auth/callback?next=/auth/nueva-clave`,
      });
      if (error) return { ok: false, error: friendly(error.message) };
      userId = data.user.id;
      await admin.auth.admin.updateUserById(userId, { app_metadata });
    }

    const { error } = await admin.from('profiles').upsert({
      id: userId, email, role: 'student', trainer_id: me.id, full_name: input.full_name.trim(), age: input.age, active: true,
    });
    if (error) return { ok: false, error: error.message };
    if (input.level) {
      await admin.from('student_training_info').upsert({ student_id: userId, level: input.level }, { onConflict: 'student_id' });
    }
    revalidatePath('/profe/alumnos');
    return { ok: true, id: userId, message: input.mode === 'invite' ? `Le enviamos la invitación a ${email}.` : 'Alumno creado. Pasale su email y la contraseña temporal.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setStudentActive(studentId: string, active: boolean): Promise<Result> {
  try {
    await ownStudent(studentId);
    const admin = supabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(studentId, { ban_duration: active ? 'none' : '876000h' });
    if (error) return { ok: false, error: error.message };
    await admin.from('profiles').update({ active }).eq('id', studentId);
    revalidatePath(`/profe/alumnos/${studentId}`);
    revalidatePath('/profe/alumnos');
    return { ok: true, message: active ? 'Acceso reactivado.' : 'Acceso pausado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteStudent(studentId: string): Promise<Result> {
  try {
    await ownStudent(studentId);
    const { error } = await supabaseAdmin().auth.admin.deleteUser(studentId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/profe/alumnos');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendAccessEmail(studentId: string): Promise<Result> {
  try {
    const { student } = await ownStudent(studentId);
    // Cliente sin PKCE: el link funciona aunque el alumno lo abra en otro dispositivo.
    const { error } = await supabaseAdmin().auth.resetPasswordForEmail(student.email, {
      redirectTo: `${await siteUrl()}/auth/callback?next=/auth/nueva-clave`,
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, message: `Le enviamos a ${student.email} un link para crear su contraseña.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setTempPassword(studentId: string, password: string): Promise<Result> {
  try {
    await ownStudent(studentId);
    if (password.length < 8) return { ok: false, error: 'Mínimo 8 caracteres.' };
    const { error } = await supabaseAdmin().auth.admin.updateUserById(studentId, { password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: 'Contraseña temporal actualizada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
