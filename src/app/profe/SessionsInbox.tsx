'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WorkoutSession } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/utils';

export type SessionItem = WorkoutSession & { studentName: string };

const mins = (s: WorkoutSession) => s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;

/** Entrenamientos finalizados con series salteadas o sin cargar. */
export default function SessionsInbox({ items }: { items: SessionItem[] }) {
  const router = useRouter();
  const [left, setLeft] = useState(items);
  async function seen(ids: string[]) {
    await supabaseBrowser().rpc('mark_sessions_seen', { p_ids: ids });
    setLeft((l) => l.filter((x) => !ids.includes(x.id)));
    router.refresh();
  }
  if (!left.length) return <p className="muted" style={{ margin: 0 }}>Ningún entrenamiento con series salteadas o sin cargar.</p>;
  return (
    <div className="stack">
      {left.map((s) => {
        const pend = s.total_sets - s.done_sets - s.skipped_sets;
        const m = mins(s);
        return (
          <article key={s.id} style={{ borderLeft: `4px solid ${pend > 0 ? 'var(--red)' : 'var(--amber)'}`, paddingLeft: 10 }}>
            <div className="row between wrap" style={{ gap: 6 }}>
              <Link href={`/profe/alumnos/${s.student_id}?tab=historial`}><b>{s.studentName}</b></Link>
              <span className="type">{fmtDate(s.performed_on, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <p style={{ margin: '2px 0' }}>
              <b>{s.day_title || 'Entrenamiento'}</b> · {s.done_sets}/{s.total_sets} series{m != null ? ` · ${m} min` : ''}
              {s.end_reason === 'manual' && pend > 0 ? <span className="tag red" style={{ marginLeft: 6 }}>finalizado antes</span> : null}
            </p>
            {(s.summary.skipped ?? []).map((x) => (
              <p key={`s-${x.exercise}`} className="small" style={{ margin: 0 }}>
                <span className="tag amber">salteó</span> {x.exercise}: {x.sets.length === 1 ? `serie ${x.sets[0]}` : `${x.sets.length} series`}{x.reason ? <> · <span className="note-hand" style={{ fontSize: '1.15rem', transform: 'none' }}>“{x.reason}”</span></> : null}
              </p>
            ))}
            {(s.summary.pending ?? []).map((x) => (
              <p key={`p-${x.exercise}`} className="small" style={{ margin: 0 }}>
                <span className="tag red">sin cargar</span> {x.exercise}: {x.sets.length === 1 ? `serie ${x.sets[0]}` : `${x.sets.length} series`}
              </p>
            ))}
            <button className="btn ghost sm" onClick={() => seen([s.id])}>Marcar como visto</button>
          </article>
        );
      })}
      {left.length > 1 && <button className="btn sm" onClick={() => seen(left.map((x) => x.id))}>Marcar todos como vistos</button>}
    </div>
  );
}
