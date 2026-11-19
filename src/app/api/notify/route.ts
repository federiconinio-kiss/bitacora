import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getMe } from '@/lib/data';
import { sendPush, type PushMessage } from '@/lib/push';
import { COMPLIED, deviationText } from '@/lib/diet';

type Event = 'progression_requested' | 'progression_resolved' | 'routine_published' | 'diet_published' | 'checkin';
const fmtKg = (n: unknown) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;
const first = (name: string | null | undefined, email: string) => (name || email).split(' ')[0];

/**
 * Envía la notificación de un evento. Todas las lecturas usan la sesión de quien llama,
 * así la seguridad de la base (RLS) garantiza que sólo pueda avisar sobre datos propios.
 */
export async function POST(request: Request) {
  const sb = await supabaseServer();
  const me = await getMe(sb);
  if (!me) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  const { event, id } = (await request.json().catch(() => ({}))) as { event?: Event; id?: string };
  if (!event || !id) return NextResponse.json({ error: 'Pedido incompleto.' }, { status: 400 });

  let to: string | null = null;
  let msg: PushMessage | null = null;

  if (event === 'progression_requested' && me.role === 'student') {
    const { data: r } = await sb.from('progression_requests')
      .select('id, status, student_id, weight_at, routine_exercises(exercises(name))').eq('id', id).maybeSingle();
    if (r && r.student_id === me.id && r.status === 'pending' && me.trainer_id) {
      const ex = (r.routine_exercises as unknown as { exercises: { name: string } })?.exercises?.name ?? 'un ejercicio';
      to = me.trainer_id;
      msg = { title: `${first(me.full_name, me.email)} llegó al tope del rango`, body: `${ex} con ${fmtKg(r.weight_at)}. Revisá la subida de carga.`, url: '/profe', tag: `prog-${r.id}` };
    }
  } else if (event === 'progression_resolved' && me.role === 'trainer') {
    const { data: r } = await sb.from('progression_requests')
      .select('id, status, student_id, new_weight, trainer_note, routine_exercises(exercises(name))').eq('id', id).maybeSingle();
    if (r && r.status !== 'pending') {
      const ex = (r.routine_exercises as unknown as { exercises: { name: string } })?.exercises?.name ?? 'tu ejercicio';
      to = r.student_id;
      msg = r.status === 'approved'
        ? { title: '¡Tu profe aprobó la subida! 🎉', body: `${ex}: ahora ${fmtKg(r.new_weight)}.${r.trainer_note ? ` “${r.trainer_note}”` : ''}`, url: '/alumno', tag: `prog-${r.id}` }
        : { title: 'Nota de tu profe', body: `${ex}: por ahora mantenemos la carga.${r.trainer_note ? ` “${r.trainer_note}”` : ''}`, url: '/alumno', tag: `prog-${r.id}` };
    }
  } else if (event === 'routine_published' && me.role === 'trainer') {
    const { data: r } = await sb.from('routines').select('id, student_id, name, published').eq('id', id).maybeSingle();
    if (r?.published) {
      to = r.student_id;
      msg = { title: 'Tenés rutina nueva 💪', body: `Tu profe publicó “${r.name}”. Entrá a verla.`, url: '/alumno', tag: `routine-${r.id}` };
    }
  } else if (event === 'diet_published' && me.role === 'trainer') {
    const { data: d } = await sb.from('diet_plans').select('id, student_id, name, published').eq('id', id).maybeSingle();
    if (d?.published) {
      to = d.student_id;
      msg = { title: 'Tenés plan de alimentación nuevo 🍽', body: `Tu profe publicó “${d.name}”. Entrá a ver tu objetivo del día.`, url: '/alumno/dieta?ver=plan', tag: `diet-${d.id}` };
    }
  } else if (event === 'checkin' && me.role === 'student') {
    const { data: c } = await sb.from('diet_checkins').select('*').eq('id', id).maybeSingle();
    if (c && c.student_id === me.id && me.trainer_id) {
      const dev = c.target_kcal
        ? deviationText(
            { kcal: Number(c.total_kcal), protein: Number(c.total_protein), carbs: Number(c.total_carbs), fat: Number(c.total_fat) },
            { kcal: c.target_kcal, protein: c.target_protein ?? 0, carbs: c.target_carbs ?? 0, fat: c.target_fat ?? 0 },
          )
        : '';
      to = me.trainer_id;
      msg = { title: `${first(me.full_name, me.email)} cerró el día: ${COMPLIED[c.complied as 'si' | 'parcial' | 'no'].label.toLowerCase()}`, body: [dev, c.comment ? `“${c.comment}”` : ''].filter(Boolean).join(' · ') || 'Mirá el detalle en Avisos.', url: '/profe', tag: `checkin-${c.id}` };
    }
  }

  if (!to || !msg) return NextResponse.json({ ok: true, sent: 0 });
  try {
    const r = await sendPush(to, msg);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('notify', e);
    return NextResponse.json({ ok: false, sent: 0 });
  }
}
