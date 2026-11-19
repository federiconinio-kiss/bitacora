'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DietDay, DietMeal, Food, FullDietPlan, Measurement, Profile, TrainingInfo } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { DAYS_SHORT, num } from '@/lib/utils';
import {
  ACTIVITIES, GOALS, METHODS, activityFactor, bmrAll, portion, r1, safetyWarnings, targets,
  type Activity, type GoalType, type Method, type Sex,
} from '@/lib/nutrition';
import MacroCounter from '@/components/MacroCounter';
import { notify } from '@/lib/notify';
import { DISCLAIMER, dayTarget, dayTotals, mealTotals } from '@/lib/diet';
import FoodPicker from '@/components/FoodPicker';
import { saveTrainingInfo } from '@/components/LevelPicker';
import { IconBack, IconDown, IconPlus, IconTrash, IconUp } from '@/components/Icons';

type Day = FullDietPlan['days'][number];
type Meal = Day['meals'][number];
type Item = Meal['items'][number];


export default function DietBuilder({ initial, student, foods: initialFoods, info, lastMeasurement, trainingWeekdays }: {
  initial: FullDietPlan; student: Profile; foods: Food[]; info: TrainingInfo | null; lastMeasurement: Measurement | null; trainingWeekdays: number[];
}) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [p, setP] = useState<FullDietPlan>(initial);
  const [foods] = useState(initialFoods);
  const [dayId, setDayId] = useState<string | null>(initial.days[0]?.id ?? null);
  const [picker, setPicker] = useState<{ mealId: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ok = (m = 'Guardado') => { setStatus(m); setErr(null); setTimeout(() => setStatus(null), 1600); };
  const fail = (e: { message: string } | null) => { if (e) { setErr(e.message); return true; } return false; };

  // ------------------------------- Cálculo -------------------------------
  const bmr = bmrAll({ weight: p.weight_kg, height: p.height_cm, age: p.age, sex: p.sex, bodyFat: p.body_fat });
  const chosenBmr = bmr[p.method];
  const tdee = chosenBmr != null ? Math.round(chosenBmr * activityFactor(p.activity)) : null;
  const target = tdee != null && p.weight_kg != null ? targets(tdee, Number(p.adjust_pct), Number(p.weight_kg), Number(p.protein_per_kg), Number(p.fat_per_kg)) : null;
  const warnings = target ? safetyWarnings(target, chosenBmr, p.sex) : [];

  async function savePlan(fields: Partial<FullDietPlan>) {
    const next = { ...p, ...fields };
    setP(next);
    const b = bmrAll({ weight: next.weight_kg, height: next.height_cm, age: next.age, sex: next.sex, bodyFat: next.body_fat });
    const cb = b[next.method];
    const t = cb != null ? Math.round(cb * activityFactor(next.activity)) : null;
    const { days: _days, ...row } = { ...fields, bmr: cb, tdee: t, updated_at: new Date().toISOString() } as Partial<FullDietPlan>;
    void _days;
    const { error } = await sb.from('diet_plans').update(row).eq('id', p.id);
    if (!fail(error)) ok();
  }

  /** Sexo, altura y actividad también se guardan en la ficha del alumno para próximos planes. */
  async function saveProfileField(fields: { sex?: Sex | null; height_cm?: number | null; activity?: Activity | null }) {
    await savePlan(fields);
    await saveTrainingInfo(p.student_id, fields);
  }

  function pickGoal(g: GoalType) {
    const goal = GOALS.find((x) => x.key === g)!;
    const sameAsDefault = !p.explanation.trim() || GOALS.some((x) => x.text === p.explanation.trim());
    savePlan({ goal_type: g, adjust_pct: goal.adjust, protein_per_kg: goal.protein, fat_per_kg: goal.fat, ...(sameAsDefault ? { explanation: goal.text } : {}) });
  }

  async function applyTargetsToDays(onlyId?: string) {
    if (!target) return;
    const ids = p.days.filter((d) => !onlyId || d.id === onlyId).map((d) => d.id);
    const fields = { target_kcal: target.kcal, target_protein: target.protein, target_carbs: target.carbs, target_fat: target.fat };
    const { error } = await sb.from('diet_days').update(fields).in('id', ids);
    if (fail(error)) return;
    setP((x) => ({ ...x, days: x.days.map((d) => (ids.includes(d.id) ? { ...d, ...fields } : d)) }));
    ok(onlyId ? 'Objetivo aplicado al día' : 'Objetivo aplicado a todos los días');
  }

  // ------------------------------- Días tipo -------------------------------
  async function addDay(title: string, weekdays: number[], position = p.days.length, meals = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']) {
    const t = target ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const { data, error } = await sb.from('diet_days').insert({
      plan_id: p.id, title, weekdays, position,
      target_kcal: t.kcal, target_protein: t.protein, target_carbs: t.carbs, target_fat: t.fat,
    }).select('*').single();
    if (fail(error)) return null;
    const { data: ms, error: e2 } = await sb.from('diet_meals')
      .insert(meals.map((m, i) => ({ day_id: data.id, title: m, position: i }))).select('*');
    if (fail(e2)) return null;
    const day: Day = { ...(data as DietDay), meals: ((ms ?? []) as DietMeal[]).sort((a, b) => a.position - b.position).map((m) => ({ ...m, items: [] })) };
    setP((x) => ({ ...x, days: [...x.days, day] }));
    setDayId(day.id);
    return day;
  }

  async function startTemplate(kind: 'two' | 'one') {
    if (kind === 'one') {
      await addDay('Todos los días', [1, 2, 3, 4, 5, 6, 7], 0);
    } else {
      const train = trainingWeekdays.length ? trainingWeekdays : [1, 2, 3, 4, 5];
      const rest = [1, 2, 3, 4, 5, 6, 7].filter((d) => !train.includes(d));
      const trainDay = await addDay('Día de entrenamiento', train, 0, ['Desayuno', 'Almuerzo', 'Merienda (pre-entreno)', 'Cena (post-entreno)']);
      await addDay('Día de descanso', rest, 1);
      if (trainDay) setDayId(trainDay.id);
    }
    ok('Días creados');
  }

  async function duplicateDay(d: Day) {
    const copy = await addDay(`${d.title} (copia)`, [], p.days.length, []);
    if (!copy) return;
    for (const m of d.meals) {
      const { data: nm, error } = await sb.from('diet_meals').insert({ day_id: copy.id, title: m.title, time_hint: m.time_hint, notes: m.notes, position: m.position }).select('*').single();
      if (fail(error)) return;
      let items: Item[] = [];
      if (m.items.length) {
        const { data: ni, error: e2 } = await sb.from('diet_meal_items')
          .insert(m.items.map((i) => ({ meal_id: nm.id, food_id: i.food_id, grams: i.grams, position: i.position }))).select('*');
        if (fail(e2)) return;
        items = ((ni ?? []) as Item[]).map((i) => ({ ...i, grams: Number(i.grams), food: foods.find((f) => f.id === i.food_id)! }));
      }
      setP((x) => ({ ...x, days: x.days.map((dd) => (dd.id === copy.id ? { ...dd, meals: [...dd.meals, { ...(nm as DietMeal), items }] } : dd)) }));
    }
    await saveDay(copy, { target_kcal: d.target_kcal, target_protein: d.target_protein, target_carbs: d.target_carbs, target_fat: d.target_fat });
    ok('Día duplicado');
  }

  const patchDay = (id: string, fn: (d: Day) => Day) => setP((x) => ({ ...x, days: x.days.map((d) => (d.id === id ? fn(d) : d)) }));

  async function saveDay(d: Day, fields: Partial<DietDay>) {
    patchDay(d.id, (x) => ({ ...x, ...fields }));
    const { error } = await sb.from('diet_days').update(fields).eq('id', d.id);
    if (!fail(error)) ok();
  }

  /** Cada día de la semana pertenece a un solo día tipo. */
  async function toggleWeekday(d: Day, wd: number) {
    const on = !d.weekdays.includes(wd);
    if (on) {
      for (const other of p.days.filter((o) => o.id !== d.id && o.weekdays.includes(wd))) {
        await saveDay(other, { weekdays: other.weekdays.filter((x) => x !== wd) });
      }
    }
    await saveDay(d, { weekdays: on ? [...d.weekdays, wd].sort() : d.weekdays.filter((x) => x !== wd) });
  }

  async function removeDay(d: Day) {
    if (!confirm(`¿Borrar el día “${d.title}” y sus comidas?`)) return;
    const { error } = await sb.from('diet_days').delete().eq('id', d.id);
    if (fail(error)) return;
    const rest = p.days.filter((x) => x.id !== d.id);
    setP((x) => ({ ...x, days: rest }));
    setDayId(rest[0]?.id ?? null);
  }

  // ------------------------------- Comidas -------------------------------
  const patchMeal = (dayId: string, mealId: string, fn: (m: Meal) => Meal) => patchDay(dayId, (d) => ({ ...d, meals: d.meals.map((m) => (m.id === mealId ? fn(m) : m)) }));

  async function addMeal(d: Day) {
    const { data, error } = await sb.from('diet_meals').insert({ day_id: d.id, title: `Comida ${d.meals.length + 1}`, position: d.meals.length }).select('*').single();
    if (fail(error)) return;
    patchDay(d.id, (x) => ({ ...x, meals: [...x.meals, { ...(data as DietMeal), items: [] }] }));
  }

  async function saveMeal(d: Day, m: Meal, fields: Partial<DietMeal>) {
    patchMeal(d.id, m.id, (x) => ({ ...x, ...fields }));
    const { error } = await sb.from('diet_meals').update(fields).eq('id', m.id);
    if (!fail(error)) ok();
  }

  async function removeMeal(d: Day, m: Meal) {
    if (m.items.length && !confirm(`¿Borrar “${m.title}” con sus alimentos?`)) return;
    const { error } = await sb.from('diet_meals').delete().eq('id', m.id);
    if (fail(error)) return;
    patchDay(d.id, (x) => ({ ...x, meals: x.meals.filter((y) => y.id !== m.id) }));
  }

  async function moveMeal(d: Day, i: number, dir: -1 | 1) {
    const list = [...d.meals];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patchDay(d.id, (x) => ({ ...x, meals: list.map((m, k) => ({ ...m, position: k })) }));
    await Promise.all(list.map((m, k) => sb.from('diet_meals').update({ position: k }).eq('id', m.id)));
  }

  async function addItem(mealId: string, food: Food) {
    const d = p.days.find((x) => x.meals.some((m) => m.id === mealId))!;
    const m = d.meals.find((x) => x.id === mealId)!;
    const grams = food.unit_grams ?? 100;
    const { data, error } = await sb.from('diet_meal_items').insert({ meal_id: mealId, food_id: food.id, grams, position: m.items.length }).select('*').single();
    if (fail(error)) return;
    patchMeal(d.id, mealId, (x) => ({ ...x, items: [...x.items, { ...(data as Item), grams: Number(data.grams), food }] }));
    ok(`${food.name} agregado`);
  }

  async function saveGrams(d: Day, m: Meal, it: Item, grams: number) {
    if (!(grams > 0) || grams === it.grams) return;
    patchMeal(d.id, m.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, grams } : i)) }));
    const { error } = await sb.from('diet_meal_items').update({ grams }).eq('id', it.id);
    if (!fail(error)) ok();
  }

  async function removeItem(d: Day, m: Meal, it: Item) {
    const { error } = await sb.from('diet_meal_items').delete().eq('id', it.id);
    if (fail(error)) return;
    patchMeal(d.id, m.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) }));
  }

  // ------------------------------- Publicar -------------------------------
  async function publish(on: boolean) {
    if (on && !p.days.some((d) => d.meals.some((m) => m.items.length))) return setErr('Agregá al menos una comida con alimentos antes de publicar.');
    if (on && p.days.some((d) => !d.target_kcal)) return setErr('Hay días sin objetivo de calorías. Completá el cálculo y tocá “Aplicar a todos los días”.');
    if (on) {
      const { error } = await sb.from('diet_plans').update({ published: false }).eq('student_id', p.student_id).neq('id', p.id);
      if (fail(error)) return;
    }
    await savePlan({ published: on });
    if (on) notify('diet_published', p.id);
    ok(on ? '¡Publicado! El alumno ya lo ve.' : 'Pasó a borrador');
    router.refresh();
  }

  const day = p.days.find((d) => d.id === dayId) ?? null;
  const totals = useMemo(() => (day ? dayTotals(day) : null), [day]);
  const uncovered = [1, 2, 3, 4, 5, 6, 7].filter((wd) => !p.days.some((d) => d.weekdays.includes(wd)));
  const usedMeasurement = lastMeasurement?.weight != null && Number(lastMeasurement.weight) === Number(p.weight_kg);

  return (
    <div className="stack-lg">
      <div className="row wrap">
        <Link href={`/profe/alumnos/${student.id}?tab=nutricion`} className="icon-btn" aria-label="Volver"><IconBack /></Link>
        <div className="grow">
          <p className="type" style={{ margin: 0 }}>Plan de alimentación de {student.full_name || student.email}</p>
          <input className="input h-hand" style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--graphite)', maxWidth: 520 }} defaultValue={p.name}
            aria-label="Nombre del plan" onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && savePlan({ name: e.target.value.trim() })} />
        </div>
        <span className="type" aria-live="polite">{status}</span>
        {p.published ? (
          <>
            <span className="stamp green">Publicado</span>
            <button className="btn sm" onClick={() => publish(false)}>Pasar a borrador</button>
          </>
        ) : (
          <button className="btn green" onClick={() => publish(true)}>Publicar para el alumno</button>
        )}
      </div>
      {err && <p className="notice red" role="alert">{err} <button className="btn ghost sm" onClick={() => setErr(null)}>ok</button></p>}

      {/* ----------------------------- 1. Cálculo ----------------------------- */}
      <section className="sheet grid-paper stack-lg">
        <div className="row between wrap">
          <h2 className="h-hand">1. Gasto calórico</h2>
          <span className="type">sexo, altura y actividad se guardan en su ficha</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '14px 18px' }}>
          <NumInput label="Peso (kg)" value={p.weight_kg} onSave={(v) => savePlan({ weight_kg: v })} />
          <NumInput label="% de grasa" value={p.body_fat} onSave={(v) => savePlan({ body_fat: v })} placeholder="opcional" />
          <NumInput label="Altura (cm)" value={p.height_cm} onSave={(v) => saveProfileField({ height_cm: v })} />
          <NumInput label="Edad" value={p.age} onSave={(v) => savePlan({ age: v == null ? null : Math.round(v) })} />
          <div className="field">
            <label>Sexo</label>
            <div className="chips" style={{ paddingTop: 6 }}>
              {(['M', 'F'] as Sex[]).map((s) => (
                <button key={s} type="button" className={`chip ${p.sex === s ? 'on' : ''}`} onClick={() => saveProfileField({ sex: s })}>{s === 'M' ? 'Hombre' : 'Mujer'}</button>
              ))}
            </div>
          </div>
        </div>
        {lastMeasurement && (
          <p className="small muted" style={{ margin: 0 }}>
            Última medición del alumno: {lastMeasurement.weight ?? '—'} kg{lastMeasurement.body_fat != null ? ` · ${lastMeasurement.body_fat}% de grasa` : ''}.{' '}
            {!usedMeasurement && lastMeasurement.weight != null && (
              <button className="btn ghost sm" onClick={() => savePlan({ weight_kg: Number(lastMeasurement.weight), body_fat: lastMeasurement.body_fat == null ? p.body_fat : Number(lastMeasurement.body_fat) })}>Usar estos datos</button>
            )}
          </p>
        )}
        <div className="stack" style={{ gap: 6 }}>
          <span className="type">Actividad física</span>
          <div className="chips">
            {ACTIVITIES.map((a) => (
              <button key={a.key} type="button" className={`chip ${p.activity === a.key ? 'on' : ''}`} onClick={() => saveProfileField({ activity: a.key })} title={a.hint}>
                {a.label} ×{a.factor}
              </button>
            ))}
          </div>
          <span className="small muted">{ACTIVITIES.find((a) => a.key === p.activity)?.hint ?? 'Elegí el nivel que mejor describe su semana (contando el gimnasio).'}</span>
        </div>

        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>Método</th><th>Necesita</th><th>Metabolismo basal</th><th>Gasto total del día</th><th /></tr></thead>
            <tbody>
              {METHODS.map((m) => {
                const v = bmr[m.key];
                return (
                  <tr key={m.key} style={p.method === m.key ? { background: 'rgba(251,233,122,.25)' } : undefined}>
                    <td><b>{m.label}</b><div className="small muted">{m.hint}</div></td>
                    <td className="type">{m.needs}</td>
                    <td className="ink" style={{ fontSize: '1.35rem' }}>{v != null ? `${v.toLocaleString('es-AR')} kcal` : <span className="type">faltan datos</span>}</td>
                    <td className="ink" style={{ fontSize: '1.35rem' }}>{v != null ? `${Math.round(v * activityFactor(p.activity)).toLocaleString('es-AR')} kcal` : '—'}</td>
                    <td>
                      <label className="checkbox">
                        <input type="radio" name="method" checked={p.method === m.key} disabled={v == null} onChange={() => savePlan({ method: m.key as Method })} /> usar
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {bmr.lbm != null && <p className="small muted" style={{ margin: 0 }}>Masa magra estimada: {bmr.lbm} kg.</p>}
      </section>

      {/* ----------------------------- 2. Objetivo ----------------------------- */}
      <section className="sheet stack-lg">
        <span className="tape" />
        <h2 className="h-hand">2. Objetivo y macros</h2>
        <div className="chips">
          {GOALS.map((g) => (
            <button key={g.key} type="button" className={`chip ${p.goal_type === g.key ? 'on' : ''}`} onClick={() => pickGoal(g.key)}>
              {g.label} <span className="type" style={{ color: 'inherit', opacity: .8 }}>{g.range}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px 18px' }}>
          <NumInput label="Ajuste calórico (%)" value={Number(p.adjust_pct)} onSave={(v) => v != null && savePlan({ adjust_pct: v })} />
          <NumInput label="Proteína (g por kg)" value={Number(p.protein_per_kg)} onSave={(v) => v != null && savePlan({ protein_per_kg: v })} />
          <NumInput label="Grasas (g por kg)" value={Number(p.fat_per_kg)} onSave={(v) => v != null && savePlan({ fat_per_kg: v })} />
        </div>
        {target && tdee ? (
          <div className="stack">
            <p style={{ margin: 0 }}>
              Gasto total <b>{tdee.toLocaleString('es-AR')} kcal</b> {Number(p.adjust_pct) >= 0 ? '+' : '−'} {Math.abs(Number(p.adjust_pct))} % ={' '}
              <span className="mark ink" style={{ fontSize: '1.6rem' }}>{target.kcal.toLocaleString('es-AR')} kcal por día</span>
              <span className="type"> ({target.kcal - tdee >= 0 ? '+' : ''}{(target.kcal - tdee).toLocaleString('es-AR')} kcal)</span>
            </p>
            <div className="scroll-x">
              <table className="ledger" style={{ maxWidth: 560 }}>
                <thead><tr><th>Macro</th><th>Gramos</th><th>kcal</th><th>% del total</th></tr></thead>
                <tbody>
                  {([['Proteína', target.protein, 4], ['Carbohidratos', target.carbs, 4], ['Grasas', target.fat, 9]] as const).map(([n, g, f]) => (
                    <tr key={n}><td><b>{n}</b></td><td className="ink" style={{ fontSize: '1.3rem' }}>{g} g</td><td>{g * f}</td><td>{Math.round((g * f * 100) / target.kcal)} %</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {warnings.map((w) => <p key={w} className="notice red small" style={{ margin: 0 }}>⚠ {w}</p>)}
            {p.days.length > 0 && (
              <div className="row wrap">
                <button className="btn" onClick={() => applyTargetsToDays()}>Aplicar a todos los días</button>
                <span className="small muted">Después podés ajustar cada día (por ejemplo, menos carbohidratos el día de descanso).</span>
              </div>
            )}
          </div>
        ) : (
          <p className="notice amber" style={{ margin: 0 }}>Completá peso, altura, edad, sexo y actividad (o el % de grasa) para calcular el objetivo.</p>
        )}
        <div className="field">
          <label htmlFor="expl">Explicación para el alumno</label>
          <textarea id="expl" className="textarea" key={p.goal_type} defaultValue={p.explanation}
            placeholder="Qué busca este plan y cómo seguirlo." onBlur={(e) => e.target.value !== p.explanation && savePlan({ explanation: e.target.value })} />
        </div>
      </section>

      {/* ----------------------------- 3. Días tipo ----------------------------- */}
      <section className="stack-lg">
        <h2 className="h-hand">3. Comidas por día tipo</h2>
        {p.days.length === 0 ? (
          <div className="sheet plain stack">
            <p style={{ margin: 0 }}>¿Cómo querés organizar la semana?</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => startTemplate('two')}>Día de entrenamiento + día de descanso</button>
              <button className="btn" onClick={() => startTemplate('one')}>Un solo día para toda la semana</button>
            </div>
            {trainingWeekdays.length > 0 && <p className="small muted" style={{ margin: 0 }}>Según su rutina entrena los {trainingWeekdays.map((d) => DAYS_SHORT[d - 1]).join(', ')}.</p>}
          </div>
        ) : (
          <>
            <div className="row wrap">
              <div className="chips" role="tablist" aria-label="Días tipo">
                {p.days.map((d) => (
                  <button key={d.id} role="tab" aria-selected={d.id === dayId} className={`chip ${d.id === dayId ? 'on' : ''}`} onClick={() => setDayId(d.id)}>
                    {d.title} <span className="type" style={{ color: 'inherit', opacity: .75 }}>{d.weekdays.map((w) => DAYS_SHORT[w - 1]).join(' ') || 'sin días'}</span>
                  </button>
                ))}
              </div>
              <button className="btn sm" onClick={() => addDay(`Día ${p.days.length + 1}`, [])}><IconPlus size={16} /> día tipo</button>
            </div>
            {uncovered.length > 0 && <p className="notice amber small" style={{ margin: 0 }}>Hay días de la semana sin plan: {uncovered.map((d) => DAYS_SHORT[d - 1]).join(', ')}.</p>}

            {day && totals && (
              <div className="stack-lg">
                <div className="sheet stack">
                  <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                    <div className="field grow" style={{ minWidth: 200 }}>
                      <label htmlFor={`dt-${day.id}`}>Nombre del día</label>
                      <input id={`dt-${day.id}`} key={day.id} className="input" style={{ fontSize: '1.8rem', fontWeight: 700 }} defaultValue={day.title}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== day.title && saveDay(day, { title: e.target.value.trim() })} />
                    </div>
                    <button className="btn sm" onClick={() => duplicateDay(day)}>Duplicar</button>
                    <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => removeDay(day)} aria-label="Borrar día tipo"><IconTrash size={18} /></button>
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="type">Se usa los días</span>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
                        <button key={wd} type="button" className={`weekday-toggle ${day.weekdays.includes(wd) ? 'on' : ''}`} onClick={() => toggleWeekday(day, wd)} aria-pressed={day.weekdays.includes(wd)}>
                          {DAYS_SHORT[wd - 1]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row between wrap">
                      <span className="type">Objetivo de este día</span>
                      {target && (day.target_kcal !== target.kcal || day.target_protein !== target.protein) && (
                        <button className="btn ghost sm" onClick={() => applyTargetsToDays(day.id)}>Usar el del cálculo ({target.kcal} kcal)</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px 18px' }}>
                      <NumInput key={`k${day.id}${day.target_kcal}`} label="kcal" value={day.target_kcal} onSave={(v) => v != null && saveDay(day, { target_kcal: Math.round(v) })} />
                      <NumInput key={`p${day.id}${day.target_protein}`} label="Proteína (g)" value={day.target_protein} onSave={(v) => v != null && saveDay(day, { target_protein: Math.round(v) })} />
                      <NumInput key={`c${day.id}${day.target_carbs}`} label="Carbos (g)" value={day.target_carbs} onSave={(v) => v != null && saveDay(day, { target_carbs: Math.round(v) })} />
                      <NumInput key={`f${day.id}${day.target_fat}`} label="Grasas (g)" value={day.target_fat} onSave={(v) => v != null && saveDay(day, { target_fat: Math.round(v) })} />
                    </div>
                  </div>
                </div>

                {day.meals.map((m, mi) => {
                  const mt = mealTotals(m);
                  return (
                    <article key={m.id} className="sheet">
                      <span className="punch" style={{ top: 26 }} />
                      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                        <span className="ex-num">{mi + 1}.</span>
                        <div className="field grow" style={{ minWidth: 160 }}>
                          <label htmlFor={`mt-${m.id}`}>Comida</label>
                          <input id={`mt-${m.id}`} className="input" style={{ fontSize: '1.5rem', fontWeight: 700 }} defaultValue={m.title}
                            onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && saveMeal(day, m, { title: e.target.value.trim() })} />
                        </div>
                        <div className="field" style={{ width: 110 }}>
                          <label htmlFor={`mh-${m.id}`}>Horario</label>
                          <input id={`mh-${m.id}`} className="input" style={{ fontSize: '1.3rem' }} placeholder="08:00" defaultValue={m.time_hint ?? ''}
                            onBlur={(e) => e.target.value !== (m.time_hint ?? '') && saveMeal(day, m, { time_hint: e.target.value.trim() || null })} />
                        </div>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="icon-btn" onClick={() => moveMeal(day, mi, -1)} aria-label="Subir comida"><IconUp size={18} /></button>
                          <button className="icon-btn" onClick={() => moveMeal(day, mi, 1)} aria-label="Bajar comida"><IconDown size={18} /></button>
                          <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => removeMeal(day, m)} aria-label="Borrar comida"><IconTrash size={18} /></button>
                        </div>
                      </div>
                      <div className="scroll-x" style={{ marginTop: 8 }}>
                        <table className="food-table">
                          <thead><tr><th>Alimento</th><th>Cantidad</th><th>kcal</th><th>P</th><th>C</th><th>G</th><th /></tr></thead>
                          <tbody>
                            {m.items.map((it) => {
                              const mac = portion(it.food, it.grams);
                              return (
                                <tr key={it.id}>
                                  <td style={{ minWidth: 160 }}>{it.food.name}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <input className="grams-in" inputMode="decimal" defaultValue={it.grams} aria-label={`Gramos de ${it.food.name}`}
                                      onBlur={(e) => { const g = num(e.target.value); if (g && g > 0) saveGrams(day, m, it, g); else e.target.value = String(it.grams); }} /> g
                                    {it.food.unit_name && it.food.unit_grams ? (
                                      <span className="type" style={{ display: 'block' }}>≈ {r1(it.grams / it.food.unit_grams)} {it.food.unit_name}</span>
                                    ) : null}
                                  </td>
                                  <td className="num">{Math.round(mac.kcal)}</td>
                                  <td className="num">{r1(mac.protein)}</td>
                                  <td className="num">{r1(mac.carbs)}</td>
                                  <td className="num">{r1(mac.fat)}</td>
                                  <td><button className="icon-btn" style={{ border: 0, width: 32, height: 32 }} onClick={() => removeItem(day, m, it)} aria-label={`Quitar ${it.food.name}`}><IconTrash size={16} /></button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {m.items.length > 0 && (
                            <tfoot><tr><td>Total de la comida</td><td /><td>{Math.round(mt.kcal)}</td><td>{r1(mt.protein)}</td><td>{r1(mt.carbs)}</td><td>{r1(mt.fat)}</td><td /></tr></tfoot>
                          )}
                        </table>
                      </div>
                      <div className="row wrap" style={{ marginTop: 8 }}>
                        <button className="btn sm" onClick={() => setPicker({ mealId: m.id })}><IconPlus size={16} /> alimento</button>
                        <input className="input grow" style={{ fontSize: '1.2rem', minWidth: 180 }} placeholder="Nota (opcional): p. ej. se puede cambiar el pollo por pescado" defaultValue={m.notes}
                          onBlur={(e) => e.target.value !== m.notes && saveMeal(day, m, { notes: e.target.value })} />
                      </div>
                    </article>
                  );
                })}
                <button className="btn" style={{ borderStyle: 'dashed', boxShadow: 'none' }} onClick={() => addMeal(day)}><IconPlus /> Agregar comida</button>

                <div className="sticky-counter">
                  <MacroCounter compact total={totals} target={dayTarget(day)} title={`${day.title}: lo pautado vs. el objetivo`} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <p className="disclaimer">El alumno ve este aviso junto al plan: “{DISCLAIMER}”</p>

      {picker && (
        <FoodPicker foods={foods} title="Agregar alimento" onClose={() => setPicker(null)}
          onPick={(f) => { addItem(picker.mealId, f); setPicker(null); }} />
      )}
    </div>
  );
}

function NumInput({ label, value, onSave, placeholder }: { label: string; value: number | null; onSave: (v: number | null) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" inputMode="decimal" defaultValue={value ?? ''} placeholder={placeholder ?? '—'} key={String(value)}
        onBlur={(e) => { const v = num(e.target.value); if (v !== (value == null ? null : Number(value))) onSave(v); }} />
    </div>
  );
}
