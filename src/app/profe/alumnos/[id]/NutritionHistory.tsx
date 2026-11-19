'use client';
import { useMemo, useState } from 'react';
import type { DietCheckin, FoodLog } from '@/lib/types';
import { COMPLIED, deviationText, logTotals } from '@/lib/diet';
import { fmtDate, todayISO } from '@/lib/utils';
import Modal from '@/components/Modal';
import { rowState } from '@/components/MacroCounter';

/** Cumplimiento de la dieta día por día (sólo lectura para el profe). */
export default function NutritionHistory({ logs, checkins, days = 21 }: { logs: FoodLog[]; checkins: DietCheckin[]; days?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const out: { day: string; logs: FoodLog[]; checkin: DietCheckin | null }[] = [];
    const d = new Date(todayISO() + 'T12:00:00');
    for (let i = 0; i < days; i++) {
      const iso = todayISO(d);
      const l = logs.filter((x) => x.logged_on === iso);
      const c = checkins.find((x) => x.day === iso) ?? null;
      if (l.length || c) out.push({ day: iso, logs: l, checkin: c });
      d.setDate(d.getDate() - 1);
    }
    return out;
  }, [logs, checkins, days]);

  const closed = rows.filter((r) => r.checkin);
  const okDays = closed.filter((r) => r.checkin!.complied === 'si').length;
  const openRow = rows.find((r) => r.day === open);

  return (
    <section className="sheet plain stack">
      <div className="row between wrap">
        <h2 className="h-hand">Cumplimiento de la dieta</h2>
        <span className="tag ink">últimos {days} días · sólo lectura</span>
      </div>
      {closed.length > 0 && (
        <p style={{ margin: 0 }}>Cerró <b>{closed.length}</b> {closed.length === 1 ? 'día' : 'días'}; cumplió el plan en <span className="mark ink" style={{ fontSize: '1.3rem' }}>{okDays} de {closed.length}</span>.</p>
      )}
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Todavía no cargó comidas en su diario.</p>
      ) : (
        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>Día</th><th>Comió</th><th>Objetivo</th><th>Desvío</th><th>¿Cumplió?</th><th>Comentario</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = logTotals(r.logs);
                const c = r.checkin;
                const g = c?.target_kcal ? { kcal: c.target_kcal, protein: c.target_protein ?? 0, carbs: c.target_carbs ?? 0, fat: c.target_fat ?? 0 } : null;
                const st = g ? rowState(t.kcal, g.kcal) : 'none';
                return (
                  <tr key={r.day} onClick={() => setOpen(r.day)} style={{ cursor: 'pointer' }} title="Ver lo que comió">
                    <td className="type">{fmtDate(r.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="ink" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap' }}>{Math.round(t.kcal).toLocaleString('es-AR')} kcal<span className="type" style={{ display: 'block' }}>P {Math.round(t.protein)} · C {Math.round(t.carbs)} · G {Math.round(t.fat)}</span></td>
                    <td className="type">{g ? `${g.kcal.toLocaleString('es-AR')} kcal` : '—'}</td>
                    <td style={{ color: st === 'over' ? 'var(--red)' : st === 'ok' ? 'var(--green)' : 'var(--graphite-2)' }}>{g ? deviationText(t, g) : '—'}</td>
                    <td>{c ? <span className={`tag ${COMPLIED[c.complied].tag}`}>{COMPLIED[c.complied].label}</span> : <span className="type muted">sin cerrar</span>}</td>
                    <td className="small" style={{ minWidth: 180 }}>{c?.comment || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {openRow && (
        <Modal title={`Lo que comió el ${fmtDate(openRow.day, { weekday: 'long', day: 'numeric', month: 'long' })}`} onClose={() => setOpen(null)}>
          {openRow.logs.length === 0 ? <p className="muted">No cargó comidas ese día.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {openRow.logs.map((l) => (
                <li key={l.id} style={{ borderBottom: '1px solid var(--rule)', padding: '6px 0' }}>
                  <span className="type">{l.logged_at?.slice(0, 5) ?? ''} {l.meal_label ? `· ${l.meal_label}` : ''}{l.plan_meal_id ? ' · del plan' : ''}</span>
                  <div>{l.grams != null && <b>{Number(l.grams)} g </b>}{l.name} <span className="type">· {Math.round(Number(l.kcal))} kcal · P {Number(l.protein)} · C {Number(l.carbs)} · G {Number(l.fat)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </section>
  );
}
