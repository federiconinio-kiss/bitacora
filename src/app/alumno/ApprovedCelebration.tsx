'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Celebration from '@/components/Celebration';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtKg } from '@/lib/utils';

type Item = { id: string; status: string; name: string; newWeight: number | null; increment: number | null; note: string };

/** Muestra el festejo cuando el profe aprobó una subida (y avisos de rechazo), una sola vez. */
export default function ApprovedCelebration({ items }: { items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(items.length > 0);
  if (!open || !items.length) return null;
  const approved = items.filter((i) => i.status === 'approved');
  const rejected = items.filter((i) => i.status === 'rejected');

  async function close() {
    setOpen(false);
    await supabaseBrowser().rpc('mark_progressions_seen', { p_ids: items.map((i) => i.id) });
    router.refresh();
  }

  const lines: React.ReactNode[] = [
    ...approved.map((a) => (
      <div key={a.id}>
        <b>{a.name}</b>: ahora <span className="mark ink">{fmtKg(a.newWeight)}</span>
        {a.increment != null && <span className="type"> (+{a.increment} kg)</span>}
        {a.note && <div className="note-hand">“{a.note}”</div>}
      </div>
    )),
    ...rejected.map((r) => (
      <div key={r.id} className="muted">
        <b>{r.name}</b>: por ahora mantenemos la carga.{r.note && <> “{r.note}”</>}
      </div>
    )),
  ];

  if (!approved.length)
    return (
      <Celebration title="Nota de tu profe" stamp="Seguimos" lines={lines} onClose={close} festive={false} />
    );
  return <Celebration title="¡Tu profe aprobó la subida!" lines={lines} onClose={close} />;
}
