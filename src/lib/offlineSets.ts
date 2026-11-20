'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cola de series pendientes en el teléfono, para cuando no hay señal en el gimnasio.
 * Cada serie tiene una clave (ejercicio + fecha + número de serie): si se edita varias veces
 * sin conexión, queda sólo el último valor. Se sube sola cuando vuelve la señal.
 */
const KEY = 'ecf:pending-sets:v1';

export type SetRow = {
  student_id: string; routine_exercise_id: string; exercise_id: string;
  performed_on: string; set_number: number; reps: number | null; weight: number | null;
  skipped?: boolean; skip_reason?: string | null;
};
export type PendingOp =
  | { k: string; type: 'upsert'; row: SetRow }
  | { k: string; type: 'delete'; routine_exercise_id: string; performed_on: string; set_number: number }
  | { k: string; type: 'swap'; routine_exercise_id: string; performed_on: string; exercise_id: string };

export const setKey = (rexId: string, date: string, n: number) => `${rexId}:${date}:${n}`;

export function readQueue(): PendingOp[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as PendingOp[]; } catch { return []; }
}
function writeQueue(q: PendingOp[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* sin almacenamiento: no hay cola */ }
}

export function enqueue(op: PendingOp) {
  const q = readQueue().filter((x) => x.k !== op.k);
  q.push(op);
  writeQueue(q);
  return q.length;
}

/** Error de conexión (y no de permisos o datos inválidos). */
export function isNetworkError(err: { message?: string } | null | undefined) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return !!err && /fetch|network|load failed|timeout|offline|connection/i.test(err.message ?? '');
}

/**
 * Sube lo pendiente en orden. Se detiene ante un error de conexión (lo reintenta después);
 * descarta las operaciones que el servidor rechaza por otro motivo.
 * Devuelve las filas subidas y si quedó algo pendiente.
 */
let flushing = false;
export async function flushQueue(sb: SupabaseClient) {
  if (flushing) return { uploaded: [] as SetRow[], remaining: readQueue().length, rejected: 0, rejectedOps: [] as PendingOp[] };
  flushing = true;
  const uploaded: SetRow[] = [];
  const rejectedOps: PendingOp[] = [];
  let rejected = 0;
  try {
    for (const op of readQueue()) {
      const res =
        op.type === 'upsert'
          ? await sb.from('set_logs').upsert(op.row, { onConflict: 'routine_exercise_id,performed_on,set_number' })
          : op.type === 'delete'
            ? await sb.from('set_logs').delete().match({ routine_exercise_id: op.routine_exercise_id, performed_on: op.performed_on, set_number: op.set_number })
            : await sb.from('set_logs').update({ exercise_id: op.exercise_id }).match({ routine_exercise_id: op.routine_exercise_id, performed_on: op.performed_on });
      if (res.error && isNetworkError(res.error)) break;
      if (res.error) { rejected++; rejectedOps.push(op); console.warn('Serie rechazada por el servidor', op, res.error); }
      else if (op.type === 'upsert') uploaded.push(op.row);
      // quitar sólo esta operación (pudo haberse encolado otra mientras subíamos)
      writeQueue(readQueue().filter((x) => !(x.k === op.k && JSON.stringify(x) === JSON.stringify(op))));
    }
  } finally {
    flushing = false;
  }
  return { uploaded, remaining: readQueue().length, rejected, rejectedOps };
}
