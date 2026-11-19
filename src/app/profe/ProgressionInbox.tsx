'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, fmtKg, num } from '@/lib/utils';
import { notify } from '@/lib/notify';

export type InboxItem = {
  id: string; studentId: string; studentName: string; exercise: string; group: string; scheme: string;
  weightAt: number | null; repsAt: number | null; target: number | null; date: string;
};

const STEPS = [1, 2, 2.5, 5, 10];

function Card({ it, onDone }: { it: InboxItem; onDone: (id: string, msg: string) => void }) {
  const base = Math.max(Number(it.target ?? 0), Number(it.weightAt ?? 0));
  const [inc, setInc] = useState(base >= 40 ? '5' : '2.5');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const incN = num(inc);

  async function resolve(approve: boolean) {
    setBusy(true);
    setErr(null);
    const { error } = await supabaseBrowser().rpc('resolve_progression', { p_request: it.id, p_approve: approve, p_increment: approve ? incN : null, p_note: note });
    setBusy(false);
    if (error) return setErr(error.message);
    notify('progression_resolved', it.id);
    onDone(it.id, approve ? `Aprobado: ${it.studentName} pasa a ${fmtKg(base + (incN ?? 0))} en ${it.exercise}.` : `Se mantiene la carga de ${it.studentName}.`);
  }

  return (
    <article className="sheet">
      <span className="punch" style={{ top: 26 }} />
      <div className="row between wrap" style={{ gap: 6 }}>
        <Link href={`/profe/alumnos/${it.studentId}`} className="type">{it.studentName}</Link>
        <span className="type">{fmtDate(it.date)}</span>
      </div>
      <h3 className="h-hand" style={{ margin: '4px 0' }}>{it.exercise}</h3>
      <p style={{ margin: 0 }}>
        Completó <b>{it.scheme}</b> con <span className="mark ink" style={{ fontSize: '1.3rem' }}>{fmtKg(it.weightAt)}</span>
        {it.repsAt != null && <> (mín. {it.repsAt} reps)</>}.
      </p>
      <div className="stack" style={{ marginTop: 14 }}>
        <span className="type">¿Cuánto sumar?</span>
        <div className="chips">
          {STEPS.map((s) => (
            <button key={s} type="button" className={`chip ${incN === s ? 'on' : ''}`} onClick={() => setInc(String(s))}>+{s} kg</button>
          ))}
          <input className="input box" style={{ width: 90, fontSize: '1.2rem' }} inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} aria-label="Kilos a sumar" />
        </div>
        <p style={{ margin: 0 }}>Nuevo peso: <span className="ink">{fmtKg(base + (incN ?? 0))}</span></p>
        <input className="input" style={{ fontSize: '1.25rem' }} placeholder="Nota para el alumno (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="notice red">{err}</p>}
        <div className="row wrap">
          <button className="btn green" disabled={busy || !incN || incN <= 0} onClick={() => resolve(true)}>Aprobar subida</button>
          <button className="btn danger" disabled={busy} onClick={() => resolve(false)}>Mantener carga</button>
        </div>
      </div>
    </article>
  );
}

export default function ProgressionInbox({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [left, setLeft] = useState(items);
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      {left.map((it) => (
        <Card key={it.id} it={it} onDone={(id, msg) => {
          setLeft((l) => l.filter((x) => x.id !== id));
          setToast(msg);
          setTimeout(() => setToast(null), 3000);
          router.refresh();
        }} />
      ))}
      {!left.length && <div className="sheet empty"><span className="stamp green big">¡Al día!</span></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
