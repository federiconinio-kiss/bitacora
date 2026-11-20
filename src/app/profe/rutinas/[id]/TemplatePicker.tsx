'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Level } from '@/lib/types';
import { LEVELS } from '@/lib/types';
import { DAYS } from '@/lib/utils';
import Modal from '@/components/Modal';
import { METHOD_LABELS, TEMPLATES, templateById, templateSets, type RoutineTemplate } from '@/lib/templates';
import type { Suggestion } from '@/lib/ai/suggest-types';

const fmtRest = (s: number) => (s < 30 ? 'sin descanso' : s % 60 === 0 ? `${s / 60}′` : `${+(s / 60).toFixed(1)}′`);

export default function TemplatePicker({ routineId, level, hasDays, onApply, onClose }: {
  routineId: string; level: Level | null; hasDays: boolean;
  onApply: (t: RoutineTemplate, withOptional: boolean) => Promise<void>; onClose: () => void;
}) {
  const [lv, setLv] = useState<Level | 'todos'>(level ?? 'todos');
  const [days, setDays] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [optional, setOptional] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Sugerencia con IA
  const [sDays, setSDays] = useState<number | null>(null);
  const [situation, setSituation] = useState('');
  const [asking, setAsking] = useState(false);
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`ecf:sug:${routineId}`);
      if (raw) setSug(JSON.parse(raw));
    } catch { /* sin storage */ }
  }, [routineId]);

  const list = useMemo(() => TEMPLATES.filter((t) => (lv === 'todos' || t.levels.includes(lv)) && (days == null || t.daysPerWeek === days)), [lv, days]);
  const suggested = sug ? templateById(sug.plantilla) : null;
  const alt = sug?.alternativa ? templateById(sug.alternativa) : null;

  async function ask() {
    setErr(null);
    setAsking(true);
    try {
      const res = await fetch('/api/sugerir-plantilla', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId, days: sDays, situation }),
      });
      const data = (await res.json().catch(() => ({}))) as { suggestion?: Suggestion; error?: string };
      if (!res.ok || !data.suggestion) throw new Error(data.error ?? 'No se pudo completar la sugerencia.');
      setSug(data.suggestion);
      try { sessionStorage.setItem(`ecf:sug:${routineId}`, JSON.stringify(data.suggestion)); } catch { /* sin storage */ }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  async function use(t: RoutineTemplate) {
    const withOpt = !!optional[t.id];
    const n = t.days.filter((d) => withOpt || !d.optional).length;
    if (hasDays && !confirm(`La rutina ya tiene días. Se agregan los ${n} días de “${t.name}” a continuación. ¿Seguimos?`)) return;
    setBusy(t.id);
    try { await onApply(t, withOpt); } finally { setBusy(null); }
  }

  function show(id: string) {
    setLv('todos'); setDays(null); setOpen(id);
    setTimeout(() => document.getElementById(`tpl-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  return (
    <Modal title="Plantillas de la guía" onClose={onClose} wide>
      <div className="stack-lg">
        <section className="sheet plain grid-paper stack" style={{ padding: 14 }}>
          <h3 className="h-hand" style={{ margin: 0 }}>¿Qué bloque le toca?</h3>
          <p className="small muted" style={{ margin: 0 }}>La IA mira el nivel, el historial de rutinas, la asistencia y cómo viene progresando, y te sugiere una plantilla según tu estrategia para combinar métodos. La decisión es tuya.</p>
          <div className="row wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
            <div className="field" style={{ width: 170 }}>
              <label htmlFor="sd">Días que puede ir</label>
              <select id="sd" className="select" value={sDays ?? ''} onChange={(e) => setSDays(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Como ahora</option>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} días</option>)}
              </select>
            </div>
            <div className="field grow" style={{ minWidth: 220 }}>
              <label htmlFor="ss">Situación (opcional)</label>
              <input id="ss" className="input" value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="Ej: anda con poco tiempo, se aburre, quiere priorizar glúteos, le molesta el hombro" />
            </div>
            <button className="btn primary" onClick={ask} disabled={asking}>{asking ? <><span className="spinner" /> Pensando…</> : sug ? 'Pedir otra sugerencia' : 'Sugerir con IA'}</button>
          </div>
          {asking && <p className="type" style={{ margin: 0 }}>Puede tardar alrededor de un minuto.</p>}
          {err && <p className="notice red" style={{ margin: 0 }}>{err}</p>}
          {sug && suggested && !asking && (
            <div className="stack" style={{ borderTop: '1.5px solid var(--graphite)', paddingTop: 10 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <span className="stamp green">Sugerida</span>
                <b className="grow" style={{ fontSize: '1.3rem' }}>{suggested.name}</b>
                <span className="type">{sug.semanas} semanas</span>
              </div>
              {sug.alerta && <p className="notice amber small" style={{ margin: 0 }}>⚠ {sug.alerta}</p>}
              <p style={{ margin: 0 }}>{sug.motivo}</p>
              {sug.ajustes.length > 0 && (
                <div><span className="type">Ajustes para este alumno</span>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{sug.ajustes.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
              )}
              <p className="small" style={{ margin: 0 }}><b>Cuándo cambiar:</b> {sug.cuando_cambiar}</p>
              <div className="row wrap">
                <button className="btn sm" onClick={() => show(suggested.id)}>Ver la plantilla</button>
                {alt && <button className="btn ghost sm" onClick={() => show(alt.id)}>Alternativa: {alt.name}</button>}
              </div>
            </div>
          )}
        </section>

        <div className="stack" style={{ gap: 8 }}>
          <div className="chips" role="radiogroup" aria-label="Nivel">
            <button type="button" className={`chip ${lv === 'todos' ? 'on' : ''}`} onClick={() => setLv('todos')}>Todos los niveles</button>
            {LEVELS.map((l) => <button key={l.key} type="button" className={`chip ${lv === l.key ? 'on' : ''}`} onClick={() => setLv(l.key)}>{l.label}</button>)}
          </div>
          <div className="chips" role="radiogroup" aria-label="Días por semana">
            <button type="button" className={`chip ${days == null ? 'on' : ''}`} onClick={() => setDays(null)}>Cualquier cantidad de días</button>
            {[3, 4, 5, 6].map((n) => <button key={n} type="button" className={`chip ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>{n} días</button>)}
          </div>
        </div>

        {list.length === 0 && <p className="muted">No hay plantillas con ese filtro.</p>}
        {list.map((t) => {
          const isOpen = open === t.id;
          const hasOpt = t.days.some((d) => d.optional);
          return (
            <article key={t.id} id={`tpl-${t.id}`} className="sheet plain stack" style={{ padding: 14, gap: 8, outline: sug?.plantilla === t.id ? '2.5px solid var(--green)' : undefined }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <b className="grow" style={{ fontSize: '1.3rem', minWidth: 200 }}>{t.name}</b>
                {sug?.plantilla === t.id && <span className="stamp green">Sugerida</span>}
                <span className="chip" style={{ cursor: 'default' }}>{METHOD_LABELS[t.method]}</span>
                <span className="chip" style={{ cursor: 'default' }}>{t.levels.map((l) => LEVELS.find((x) => x.key === l)!.label).join(' · ')}</span>
              </div>
              <p className="small" style={{ margin: 0 }}>{t.forWho}</p>
              <p className="type" style={{ margin: 0 }}>{t.role} · {t.daysPerWeek} días · {templateSets(t)} series por semana</p>
              {isOpen && (
                <div className="stack" style={{ gap: 10 }}>
                  {t.days.map((d) => (
                    <div key={d.title}>
                      <b>{d.title}</b> <span className="type">{d.dow ? DAYS[d.dow - 1] : 'día libre'}{d.optional ? ' · opcional' : ''}</span>
                      <table className="ledger" style={{ marginTop: 4 }}>
                        <tbody>
                          {d.exercises.map((e, i) => (
                            <tr key={i}>
                              <td>{e.name}{e.alts.length > 0 && <span className="type" style={{ display: 'block' }}>o {e.alts.join(', ')}</span>}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{e.sets} × {e.rep_min === e.rep_max ? e.rep_min : `${e.rep_min}–${e.rep_max}`}</td>
                              <td className="hide-mobile">{e.note}</td>
                              <td className="hide-mobile" style={{ whiteSpace: 'nowrap' }}>{fmtRest(e.rest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <div><span className="type">Progresión (queda en las indicaciones generales)</span>
                    <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{t.progression}</p></div>
                  {(t.pros || t.cons) && (
                    <div className="grid-2 small">
                      {t.pros && <div><span className="type">Ventajas</span><ul style={{ margin: 0, paddingLeft: 20 }}>{t.pros.map((p) => <li key={p}>{p}</li>)}</ul></div>}
                      {t.cons && <div><span className="type">Desventajas</span><ul style={{ margin: 0, paddingLeft: 20 }}>{t.cons.map((p) => <li key={p}>{p}</li>)}</ul></div>}
                    </div>
                  )}
                </div>
              )}
              <div className="row wrap">
                <button className="btn sm" onClick={() => setOpen(isOpen ? null : t.id)}>{isOpen ? 'Ocultar detalle' : 'Ver detalle'}</button>
                {hasOpt && (
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" checked={!!optional[t.id]} onChange={(e) => setOptional((o) => ({ ...o, [t.id]: e.target.checked }))} />
                    Incluir el día opcional
                  </label>
                )}
                <button className="btn primary sm" disabled={!!busy} onClick={() => use(t)}>{busy === t.id ? <span className="spinner" /> : 'Usar esta plantilla'}</button>
              </div>
            </article>
          );
        })}
        <p className="type" style={{ margin: 0 }}>Todo queda editable después: ejercicios, series, reps, pausas y notas. Las cargas las define el alumno en su primera sesión.</p>
      </div>
    </Modal>
  );
}
