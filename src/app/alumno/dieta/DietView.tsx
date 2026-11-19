'use client';
import { useState } from 'react';
import type { FullDietPlan } from '@/lib/types';
import { dayForWeekday, dayTarget, dayTotals, mealTotals } from '@/lib/diet';
import { GOALS, portion, r1 } from '@/lib/nutrition';
import { DAYS, DAYS_SHORT } from '@/lib/utils';
import MacroCounter from '@/components/MacroCounter';

export default function DietView({ plan, todayWeekday, disclaimer }: { plan: FullDietPlan; todayWeekday: number; disclaimer: string }) {
  const todayDay = dayForWeekday(plan.days, todayWeekday);
  const [dayId, setDayId] = useState(todayDay?.id ?? plan.days[0].id);
  const day = plan.days.find((d) => d.id === dayId)!;
  const t = dayTarget(day);
  const goal = GOALS.find((g) => g.key === plan.goal_type);
  const isToday = day.id === todayDay?.id;

  return (
    <div className="stack-lg">
      <div>
        <p className="type" style={{ margin: 0 }}>{plan.name}</p>
        <h1 className="h-hand">Mi dieta</h1>
      </div>

      <section className="sheet tilt-l">
        <span className="tape" />
        <p className="type" style={{ margin: 0 }}>Objetivo · {goal?.label}</p>
        {plan.explanation && <p className="ink" style={{ fontSize: '1.45rem', margin: '8px 0 0', whiteSpace: 'pre-line', lineHeight: 1.2 }}>{plan.explanation}</p>}
      </section>

      {plan.days.length > 1 && (
        <div className="chips" role="tablist" aria-label="Día">
          {plan.days.map((d) => (
            <button key={d.id} role="tab" aria-selected={d.id === dayId} className={`chip ${d.id === dayId ? 'on' : ''}`} onClick={() => setDayId(d.id)}>
              {d.title}{d.id === todayDay?.id ? ' · hoy' : ''}
            </button>
          ))}
        </div>
      )}

      <section className="sheet grid-paper stack">
        <div className="row between wrap">
          <h2 className="h-hand">{isToday ? 'Tu objetivo de hoy' : `Objetivo: ${day.title}`}</h2>
          <span className="type">{day.weekdays.length === 7 ? 'todos los días' : day.weekdays.map((w) => DAYS[w - 1]).join(', ')}</span>
        </div>
        <div className="row wrap" style={{ gap: '6px 22px', alignItems: 'baseline' }}>
          <span className="mark ink" style={{ fontSize: '2.2rem' }}>{t.kcal.toLocaleString('es-AR')} kcal</span>
          <span className="ink">P {t.protein} g</span>
          <span className="ink">C {t.carbs} g</span>
          <span className="ink">G {t.fat} g</span>
        </div>
        <MacroCounter compact total={dayTotals(day)} target={t} title="Lo que suma el plan de este día" />
      </section>

      {day.meals.filter((m) => m.items.length).map((m) => {
        const mt = mealTotals(m);
        return (
          <article key={m.id} className="sheet">
            <span className="punch" style={{ top: 26 }} />
            <div className="row between wrap">
              <h2 className="h-hand">{m.title}</h2>
              <span className="type">{m.time_hint ? `${m.time_hint} · ` : ''}{Math.round(mt.kcal)} kcal</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
              {m.items.map((it) => {
                const mac = portion(it.food, it.grams);
                const units = it.food.unit_name && it.food.unit_grams ? r1(it.grams / it.food.unit_grams) : null;
                return (
                  <li key={it.id} style={{ borderBottom: '1px solid var(--rule)', padding: '6px 0', minHeight: 32 }}>
                    <div className="row between" style={{ alignItems: 'baseline', gap: 10 }}>
                      <span><b className="ink" style={{ fontSize: '1.4rem' }}>{it.grams} g</b> {it.food.name}</span>
                      <span className="type" style={{ whiteSpace: 'nowrap' }}>{Math.round(mac.kcal)} kcal</span>
                    </div>
                    <span className="type muted">
                      {units != null ? `≈ ${units} ${it.food.unit_name} · ` : ''}P {r1(mac.protein)} · C {r1(mac.carbs)} · G {r1(mac.fat)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="type" style={{ margin: '6px 0 0' }}>Total: P {r1(mt.protein)} g · C {r1(mt.carbs)} g · G {r1(mt.fat)} g</p>
            {m.notes && <p className="note-hand" style={{ margin: '6px 0 0' }}>{m.notes}</p>}
          </article>
        );
      })}

      <p className="disclaimer">⚕ {disclaimer}</p>
      <p className="type muted" style={{ margin: 0, textAlign: 'center' }}>Días: {plan.days.map((d) => `${d.title} (${d.weekdays.map((w) => DAYS_SHORT[w - 1]).join(' ')})`).join(' · ')}</p>
    </div>
  );
}
