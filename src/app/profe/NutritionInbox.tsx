'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DietCheckin } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { COMPLIED, bigDeviation, deviationText } from '@/lib/diet';
import { fmtDate } from '@/lib/utils';

export type CheckinItem = DietCheckin & { studentName: string };

const totalOf = (c: DietCheckin) => ({ kcal: Number(c.total_kcal), protein: Number(c.total_protein), carbs: Number(c.total_carbs), fat: Number(c.total_fat) });
const targetOf = (c: DietCheckin) => ({ kcal: c.target_kcal ?? 0, protein: c.target_protein ?? 0, carbs: c.target_carbs ?? 0, fat: c.target_fat ?? 0 });

export default function NutritionInbox({ items }: { items: CheckinItem[] }) {
  const router = useRouter();
  const [left, setLeft] = useState(items);
  async function seen(ids: string[]) {
    await supabaseBrowser().rpc('mark_checkins_seen', { p_ids: ids });
    setLeft((l) => l.filter((x) => !ids.includes(x.id)));
    router.refresh();
  }
  if (!left.length) return <p className="muted" style={{ margin: 0 }}>No hay cierres de día nuevos.</p>;
  return (
    <div className="stack">
      {left.map((c) => {
        const t = totalOf(c), g = targetOf(c);
        const big = bigDeviation(t, g);
        return (
          <article key={c.id} style={{ borderLeft: `4px solid ${c.complied === 'si' && !big ? 'var(--green)' : c.complied === 'no' || big ? 'var(--red)' : 'var(--amber)'}`, paddingLeft: 10 }}>
            <div className="row between wrap" style={{ gap: 6 }}>
              <Link href={`/profe/alumnos/${c.student_id}?tab=nutricion`}><b>{c.studentName}</b></Link>
              <span className="type">{fmtDate(c.day, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
              <span className={`tag ${COMPLIED[c.complied].tag}`}>{COMPLIED[c.complied].label}</span>
              <span className="ink" style={{ fontSize: '1.2rem' }}>{deviationText(t, g)}</span>
            </div>
            <p className="type" style={{ margin: '2px 0 0' }}>Comió {Math.round(t.kcal).toLocaleString('es-AR')} de {g.kcal.toLocaleString('es-AR')} kcal · P {Math.round(t.protein)}/{g.protein} g</p>
            {c.comment && <p className="note-hand" style={{ margin: '4px 0 0', fontSize: '1.25rem' }}>“{c.comment}”</p>}
            <button className="btn ghost sm" onClick={() => seen([c.id])}>Marcar como visto</button>
          </article>
        );
      })}
      {left.length > 1 && <button className="btn sm" onClick={() => seen(left.map((c) => c.id))}>Marcar todos como vistos</button>}
    </div>
  );
}
