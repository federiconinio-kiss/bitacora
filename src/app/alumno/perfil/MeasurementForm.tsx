'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Measurement } from '@/lib/types';
import { MEASURE_FIELDS } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { daysBetween, fmtDate, num, todayISO } from '@/lib/utils';
import { IconTrash } from '@/components/Icons';

export default function MeasurementForm({ studentId, recent }: { studentId: string; recent: Measurement[] }) {
  const router = useRouter();
  const today = todayISO();
  const existing = recent.find((m) => m.measured_on === today);
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, existing?.[f.key]?.toString() ?? ''])),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const last = recent[0];
  const since = last ? daysBetween(last.measured_on, today) : null;

  function pick(d: string) {
    setDate(d);
    const m = recent.find((x) => x.measured_on === d);
    setVals(Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, m?.[f.key]?.toString() ?? ''])));
    setNotes(m?.notes ?? '');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row: Record<string, unknown> = { student_id: studentId, measured_on: date, notes };
    MEASURE_FIELDS.forEach((f) => (row[f.key] = num(vals[f.key])));
    if (MEASURE_FIELDS.every((f) => row[f.key] == null)) return setMsg({ ok: false, text: 'Cargá al menos una medida.' });
    setBusy(true);
    const { error } = await supabaseBrowser().from('measurements').upsert(row, { onConflict: 'student_id,measured_on' });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: '¡Medidas guardadas!' });
    if (!error) router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('¿Borrar esta medición?')) return;
    await supabaseBrowser().from('measurements').delete().eq('id', id);
    router.refresh();
  }

  return (
    <section id="medir" className="sheet">
      <span className="punch" style={{ top: 30 }} />
      <div className="row between wrap">
        <h2 className="h-hand">Peso y medidas</h2>
        {since != null && <span className={`tag ${since >= 14 ? 'amber' : 'green'}`}>{since >= 14 ? `hace ${since} días · toca medir` : `próxima en ${14 - since} días`}</span>}
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>Medite cada 2 semanas: en ayunas, a la mañana, cintura a la altura del ombligo.</p>
      <form onSubmit={save} className="stack-lg">
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="md">Fecha</label>
          <input id="md" type="date" className="input" max={today} value={date} onChange={(e) => e.target.value && pick(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px 18px' }}>
          {MEASURE_FIELDS.map((f) => (
            <div key={f.key} className="field">
              <label htmlFor={`m-${f.key}`}>{f.label} ({f.unit})</label>
              <input id={`m-${f.key}`} className="input" inputMode="decimal" value={vals[f.key]} placeholder={last?.[f.key]?.toString() ?? ''}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="field"><label htmlFor="mn">Notas</label><textarea id="mn" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cómo te sentiste, descanso, etc." /></div>
        {msg && <p className={`notice ${msg.ok ? 'green' : 'red'}`}>{msg.text}</p>}
        <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Guardar medidas'}</button>
      </form>

      {recent.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <span className="type">Últimas mediciones</span>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
            {recent.map((m) => (
              <li key={m.id} className="row between" style={{ borderBottom: '1px solid var(--rule)', minHeight: 40 }}>
                <button type="button" className="btn ghost sm" onClick={() => pick(m.measured_on)}>{fmtDate(m.measured_on, { day: 'numeric', month: 'short', year: '2-digit' })}</button>
                <span className="ink grow" style={{ fontSize: '1.25rem' }}>{m.weight != null && `${m.weight} kg`}{m.waist != null && ` · cintura ${m.waist}`}</span>
                <button type="button" className="icon-btn" style={{ border: 0 }} onClick={() => remove(m.id)} aria-label="Borrar medición"><IconTrash size={18} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
