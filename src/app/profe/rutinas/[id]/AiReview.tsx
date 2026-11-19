'use client';
import { useEffect, useRef, useState } from 'react';
import type { Level, RoutineReview } from '@/lib/types';
import { LEVELS } from '@/lib/types';
import { METHODOLOGY_LABELS, type Review } from '@/lib/ai/review-types';
import { LevelChips, saveTrainingInfo } from '@/components/LevelPicker';
import { fmtDate } from '@/lib/utils';
import { supabaseBrowser } from '@/lib/supabase/client';

type Methodology = keyof typeof METHODOLOGY_LABELS;

const WAIT_LINES = [
  'Leyendo la rutina día por día…',
  'Contando series por grupo muscular…',
  'Comparando con el nivel del alumno…',
  'Revisando contra el objetivo…',
  'Anotando sugerencias en el margen…',
];

const verdictTag = (v: string) => (v === 'adecuada' ? 'green' : v === 'mejorable' ? 'amber' : 'red');
const volTag = (v: string) => (v === 'adecuado' ? 'green' : v === 'bajo' ? 'amber' : 'red');
const prioColor = (p: string) => (p === 'alta' ? 'var(--red)' : p === 'media' ? 'var(--amber)' : 'var(--graphite-3)');

export default function AiReview({ routineId, studentId, studentName, goal, initialLevel, initialReviews }: {
  routineId: string; studentId: string; studentName: string; goal: string; initialLevel: Level | null; initialReviews: RoutineReview[];
}) {
  const [level, setLevel] = useState<Level | null>(initialLevel);
  const [method, setMethod] = useState<Methodology>('evidencia');
  const [reviews, setReviews] = useState(initialReviews);
  const [shownId, setShownId] = useState(initialReviews[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [busy]);

  async function pickLevel(l: Level) {
    setLevel(l);
    const { error } = await saveTrainingInfo(studentId, { level: l });
    if (error) setErr('No se pudo guardar el nivel: ' + error.message);
  }

  async function run() {
    setErr(null);
    setBusy(true);
    setTick(0);
    // Deja terminar de guardar el último campo editado antes de leer la rutina.
    (document.activeElement as HTMLElement | null)?.blur();
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch('/api/revisar-rutina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId, methodology: method }),
      });
      const data = (await res.json().catch(() => ({}))) as { review?: RoutineReview; error?: string };
      if (!res.ok || !data.review) throw new Error(data.error ?? 'No se pudo completar la revisión.');
      setReviews((r) => [data.review!, ...r]);
      setShownId(data.review.id);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('routine_reviews').delete().eq('id', id);
    if (error) return setErr(error.message);
    const rest = reviews.filter((r) => r.id !== id);
    setReviews(rest);
    setShownId(rest[0]?.id ?? null);
  }

  const shown = reviews.find((r) => r.id === shownId) ?? null;

  return (
    <section id="revision" className="stack-lg">
      <div className="sheet grid-paper stack-lg">
        <div className="row between wrap">
          <h2 className="h-hand">Revisión con IA</h2>
          <span className="tag ink">opcional · antes de publicar</span>
        </div>
        <p style={{ margin: 0 }}>
          Una segunda mirada sobre la rutina de <b>{studentName}</b>: si se ajusta a su nivel y a su objetivo, cómo queda el volumen por grupo muscular y qué cambiarías. La rutina no se modifica: vos decidís qué aplicar.
        </p>

        <div className="grid-2">
          <div className="stack" style={{ gap: 6 }}>
            <span className="type">Nivel del alumno</span>
            <LevelChips value={level} onChange={pickLevel} disabled={busy} />
            <span className="small muted">{level ? LEVELS.find((l) => l.key === level)?.hint : 'Sin nivel cargado: la IA evalúa sin ese dato.'}</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="type">Marco de referencia</span>
            <div className="chips" role="radiogroup" aria-label="Marco de referencia">
              {(Object.keys(METHODOLOGY_LABELS) as Methodology[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} disabled={busy}
                  className={`chip ${method === m ? 'on' : ''}`} onClick={() => setMethod(m)}>
                  {METHODOLOGY_LABELS[m]}
                </button>
              ))}
            </div>
            <span className="small muted">
              {method === 'evidencia' ? 'Consenso de la investigación actual (volumen, cercanía al fallo, ejercicios en estiramiento, descansos) y la práctica aceptada en el gimnasio.'
                : method === 'piramide' ? 'Volumen, intensidad y frecuencia según Helms (RIR, 10–20 series por grupo, 2×/semana).'
                : method === 'heavy_duty' ? 'Alta intensidad según Mentzer: pocas series al fallo y mucha recuperación.'
                : 'Evalúa con los dos marcos y te muestra en qué coinciden y en qué no.'}
            </span>
          </div>
        </div>
        {!goal.trim() && <p className="notice amber small" style={{ margin: 0 }}>La rutina no tiene objetivo cargado. Completalo arriba para que la revisión sea más precisa.</p>}
        {err && <p className="notice red" role="alert" style={{ margin: 0 }}>{err}</p>}
        <div className="row wrap">
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? <><span className="spinner" /> Revisando…</> : reviews.length ? 'Revisar de nuevo' : 'Revisar con IA'}
          </button>
          {busy && <span className="note-hand" aria-live="polite">{WAIT_LINES[tick % WAIT_LINES.length]} <span className="type">(puede tardar 1–2 min)</span></span>}
        </div>
      </div>

      {reviews.length > 1 && (
        <div className="chips" aria-label="Revisiones anteriores">
          {reviews.map((r) => (
            <button key={r.id} className={`chip ${r.id === shownId ? 'on' : ''}`} onClick={() => setShownId(r.id)}>
              {fmtDate(r.created_at.slice(0, 10))} · {METHODOLOGY_LABELS[r.methodology]} · {r.result.puntaje}/10
            </button>
          ))}
        </div>
      )}

      <div ref={resultRef}>{shown && <ReviewSheet review={shown} onDelete={() => remove(shown.id)} />}</div>
    </section>
  );
}

function ReviewSheet({ review, onDelete }: { review: RoutineReview; onDelete: () => void }) {
  const r: Review = review.result;
  const score = Math.max(1, Math.min(10, Math.round(r.puntaje)));
  return (
    <article className="sheet stack-lg" aria-label="Resultado de la revisión">
      <span className="tape" />
      <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 220 }}>
          <p className="type" style={{ margin: 0 }}>
            {METHODOLOGY_LABELS[review.methodology]} · nivel {review.level ?? 'sin indicar'} · {fmtDate(review.created_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="ink" style={{ margin: '8px 0 0', fontSize: '1.45rem' }}>{r.resumen}</p>
        </div>
        <span className={`stamp big ${score >= 7 ? 'green' : ''}`} aria-label={`Puntaje ${score} de 10`}>{score}/10</span>
      </div>

      <div className="grid-2">
        <div className="stack" style={{ gap: 4 }}>
          <span className="type">Para su nivel <span className={`tag ${verdictTag(r.nivel.veredicto)}`}>{r.nivel.veredicto}</span></span>
          <p style={{ margin: 0 }}>{r.nivel.explicacion}</p>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="type">Para su objetivo <span className={`tag ${verdictTag(r.objetivo.veredicto)}`}>{r.objetivo.veredicto}</span></span>
          <p style={{ margin: 0 }}>{r.objetivo.explicacion}</p>
        </div>
      </div>

      <div>
        <h3 className="h-hand" style={{ marginBottom: 6 }}>Sugerencias</h3>
        <ol style={{ margin: 0, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.sugerencias.map((s, i) => (
            <li key={i} style={{ borderLeft: `4px solid ${prioColor(s.prioridad)}`, paddingLeft: 10 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="tag" style={{ color: prioColor(s.prioridad) }}>{s.prioridad}</span>
                <span className="type">{s.categoria}{s.dia ? ` · ${s.dia}` : ''}{s.ejercicio ? ` · ${s.ejercicio}` : ''}</span>
              </div>
              <div style={{ fontSize: '1.08rem', marginTop: 2 }}><b>{s.cambio}</b></div>
              <div className="note-hand" style={{ fontSize: '1.2rem', transform: 'none' }}>{s.motivo}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="scroll-x">
        <h3 className="h-hand" style={{ marginBottom: 6 }}>Volumen por grupo muscular</h3>
        <table className="ledger">
          <thead><tr><th>Grupo</th><th>Series/sem.</th><th>Días</th><th>Evaluación</th><th>Comentario</th></tr></thead>
          <tbody>
            {r.volumen_por_grupo.map((v) => (
              <tr key={v.grupo}>
                <td><b>{v.grupo}</b></td>
                <td className="ink" style={{ fontSize: '1.3rem' }}>{v.series_semanales}</td>
                <td className="ink" style={{ fontSize: '1.3rem' }}>{v.frecuencia_semanal}</td>
                <td><span className={`tag ${volTag(v.evaluacion)}`}>{v.evaluacion}</span></td>
                <td className="small" style={{ minWidth: 220 }}>{v.comentario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.puntos_fuertes.length > 0 && (
        <div className="postit green">
          <b>Lo que está bien:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{r.puntos_fuertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      <div className="row between wrap">
        <span className="small muted">Es una sugerencia generada por IA: revisala con tu criterio antes de aplicarla.</span>
        <button className="btn ghost sm" onClick={onDelete}>Borrar esta revisión</button>
      </div>
    </article>
  );
}
