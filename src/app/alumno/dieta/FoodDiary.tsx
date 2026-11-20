'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DietCheckin, Food, FoodLog, FullDietPlan } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { COMPLIED, deviationText, hasMeals, logTotals, mealTotals, targetForWeekday } from '@/lib/diet';
import { portion, r1, type Macros } from '@/lib/nutrition';
import { fmtDate, isoWeekday, num, todayISO } from '@/lib/utils';
import MacroCounter from '@/components/MacroCounter';
import { notify } from '@/lib/notify';
import Modal from '@/components/Modal';
import { FoodMacrosLine, searchFoods } from '@/components/FoodPicker';
import { IconBack, IconCheck, IconPlus, IconSearch, IconTrash } from '@/components/Icons';

type Day = FullDietPlan['days'][number];
type Meal = Day['meals'][number];

const DEFAULT_MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Colación'];
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const validTime = (t: string | null | undefined) => (t && /^\d{1,2}:\d{2}$/.test(t.trim()) ? t.trim().padStart(5, '0') : null);
const shiftDate = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return todayISO(x); };
const asNum = (l: FoodLog): FoodLog => ({ ...l, kcal: Number(l.kcal), protein: Number(l.protein), carbs: Number(l.carbs), fat: Number(l.fat), grams: l.grams == null ? null : Number(l.grams) });

export default function FoodDiary({ studentId, date, plan, initialLogs, initialCheckin, foods }: {
  studentId: string; date: string; plan: FullDietPlan | null; initialLogs: FoodLog[]; initialCheckin: DietCheckin | null; foods: Food[];
}) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs.map(asNum));
  const [checkin, setCheckin] = useState(initialCheckin);
  const [adding, setAdding] = useState<{ meal: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isToday = date === todayISO();

  const { target, day } = plan ? targetForWeekday(plan, isoWeekday(date)) : { target: null as Macros | null, day: null };
  const total = useMemo(() => logTotals(logs), [logs]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const mealNames = useMemo(() => {
    const fromPlan = day?.meals.map((m) => m.title) ?? [];
    return [...new Set([...fromPlan, ...DEFAULT_MEALS])];
  }, [day]);

  // Entradas agrupadas por comida, en el orden del plan (o el orden habitual)
  const groups = useMemo(() => {
    const order = (label: string) => { const i = mealNames.indexOf(label); return i < 0 ? 99 : i; };
    const map = new Map<string, FoodLog[]>();
    for (const l of logs) { const k = l.meal_label || 'Otros'; map.set(k, [...(map.get(k) ?? []), l]); }
    return [...map.entries()].sort(([a], [b]) => order(a) - order(b));
  }, [logs, mealNames]);

  async function insertLogs(rows: Omit<FoodLog, 'id' | 'created_at' | 'student_id' | 'logged_on'>[]) {
    const { data, error } = await sb.from('food_logs')
      .insert(rows.map((r) => ({ ...r, student_id: studentId, logged_on: date }))).select('*');
    if (error) { setErr('No se pudo guardar: ' + error.message); return false; }
    setLogs((l) => [...l, ...((data ?? []) as FoodLog[]).map(asNum)]);
    return true;
  }

  async function ateAsPlanned(m: Meal) {
    const time = validTime(m.time_hint) ?? (isToday ? nowHHMM() : null);
    const ok = await insertLogs(m.items.map((it) => {
      const mac = portion(it.food, it.grams);
      return {
        logged_at: time, meal_label: m.title, plan_meal_id: m.id, food_id: it.food.id, grams: it.grams, name: it.food.name,
        kcal: r1(mac.kcal), protein: r1(mac.protein), carbs: r1(mac.carbs), fat: r1(mac.fat),
      };
    }));
    if (ok) flash(`✓ ${m.title} cargada como estaba en el plan`);
  }

  async function undoMeal(m: Meal) {
    const ids = logs.filter((l) => l.plan_meal_id === m.id).map((l) => l.id);
    const { error } = await sb.from('food_logs').delete().in('id', ids);
    if (error) return setErr(error.message);
    setLogs((l) => l.filter((x) => !ids.includes(x.id)));
  }

  async function removeLog(id: string) {
    const { error } = await sb.from('food_logs').delete().eq('id', id);
    if (error) return setErr(error.message);
    setLogs((l) => l.filter((x) => x.id !== id));
  }

  function goTo(d: string) { router.push(`/alumno/dieta?fecha=${d}`); }

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={() => goTo(shiftDate(date, -1))} aria-label="Día anterior"><IconBack size={20} /></button>
          <input type="date" className="input box" style={{ width: 'auto', fontSize: '1.15rem' }} value={date} max={todayISO()} onChange={(e) => e.target.value && goTo(e.target.value)} aria-label="Fecha" />
          {!isToday && <button className="icon-btn" style={{ transform: 'scaleX(-1)' }} onClick={() => goTo(shiftDate(date, 1))} aria-label="Día siguiente"><IconBack size={20} /></button>}
        </div>
        <span className="type">{isToday ? 'Hoy' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}{day ? ` · ${day.title}` : ''}</span>
      </div>

      <section className="sheet grid-paper stack">
        {target ? (
          <MacroCounter total={total} target={target} title={isToday ? 'Lo que llevás comido hoy vs. tu objetivo' : 'Lo que comiste vs. tu objetivo'} />
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            <span className="type">{isToday ? 'Lo que llevás comido hoy' : 'Lo que comiste ese día'}</span>
            <div className="row wrap" style={{ gap: '6px 22px', alignItems: 'baseline' }}>
              <span className="mark ink" style={{ fontSize: '2rem' }}>{Math.round(total.kcal).toLocaleString('es-AR')} kcal</span>
              <span className="ink">P {Math.round(total.protein)} g</span>
              <span className="ink">C {Math.round(total.carbs)} g</span>
              <span className="ink">G {Math.round(total.fat)} g</span>
            </div>
          </div>
        )}
      </section>

      {err && <p className="notice red" role="alert">{err} <button className="btn ghost sm" onClick={() => setErr(null)}>ok</button></p>}

      {day && day.meals.some((m) => m.items.length) && (
        <section className="stack">
          <h2 className="h-hand">Tu plan de {isToday ? 'hoy' : 'ese día'}</h2>
          {day.meals.filter((m) => m.items.length).map((m) => {
            const done = logs.some((l) => l.plan_meal_id === m.id);
            const other = !done && logs.some((l) => !l.plan_meal_id && l.meal_label === m.title);
            const mt = mealTotals(m);
            return (
              <article key={m.id} className="sheet" style={done ? { opacity: .85 } : undefined}>
                <div className="row between wrap">
                  <h3 className="h-hand">{m.title}</h3>
                  <span className="type">{m.time_hint ? `${m.time_hint} · ` : ''}{Math.round(mt.kcal)} kcal</span>
                </div>
                <p className="small muted" style={{ margin: '4px 0 8px' }}>{m.items.map((i) => `${i.grams} g ${i.food.name}`).join(' · ')}</p>
                {done ? (
                  <div className="row wrap">
                    <span className="stamp green" style={{ fontSize: '.8rem' }}>✓ Cargada</span>
                    <button className="btn ghost sm" onClick={() => undoMeal(m)}>Deshacer</button>
                  </div>
                ) : other ? (
                  <div className="row wrap">
                    <span className="stamp" style={{ fontSize: '.8rem', color: 'var(--amber)', borderColor: 'var(--amber)' }}>Comiste otra cosa</span>
                    <button className="btn ghost sm" onClick={() => setAdding({ meal: m.title })}>Agregar más</button>
                  </div>
                ) : (
                  <div className="row wrap">
                    <button className="btn green sm" onClick={() => ateAsPlanned(m)}><IconCheck size={18} /> La comí como estaba</button>
                    <button className="btn sm" onClick={() => setAdding({ meal: m.title })}>Comí otra cosa</button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="sheet stack">
        <span className="punch" style={{ top: 26 }} />
        <div className="row between wrap">
          <h2 className="h-hand">{isToday ? 'Lo que comí hoy' : 'Lo que comí'}</h2>
          <button className="btn primary sm" onClick={() => setAdding({ meal: mealNames[0] })}><IconPlus size={18} /> Agregar</button>
        </div>
        {groups.length === 0 && <p className="muted" style={{ margin: 0 }}>Todavía no cargaste nada{isToday ? ' hoy' : ''}. Buscá un alimento o hacé un agregado rápido.</p>}
        {groups.map(([label, list]) => {
          const gt = logTotals(list);
          return (
            <div key={label}>
              <div style={{ borderBottom: '1.5px solid var(--graphite)', paddingBottom: 2, marginTop: 6 }}>
                <b>{label}</b>{' '}
                <span className="type" style={{ whiteSpace: 'nowrap' }}>· {Math.round(gt.kcal)} kcal</span>
                <span className="type" style={{ display: 'block' }}>P {Math.round(gt.protein)} g · C {Math.round(gt.carbs)} g · G {Math.round(gt.fat)} g</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.map((l) => (
                  <li key={l.id} className="row" style={{ borderBottom: '1px solid var(--rule)', padding: '4px 0', gap: 8, alignItems: 'center' }}>
                    <span className="type" style={{ width: 44 }}>{l.logged_at?.slice(0, 5) ?? ''}</span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      {l.grams != null && <b className="ink" style={{ fontSize: '1.2rem' }}>{r1(l.grams)} g </b>}{l.name}
                      <span className="type" style={{ display: 'block' }}>{Math.round(l.kcal)} kcal · P {r1(l.protein)} · C {r1(l.carbs)} · G {r1(l.fat)}</span>
                    </span>
                    <button className="icon-btn" style={{ border: 0, width: 34, height: 34 }} onClick={() => removeLog(l.id)} aria-label={`Borrar ${l.name}`}><IconTrash size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {plan && target && (
        <CloseDay studentId={studentId} date={date} planId={plan.id} total={total} target={target} checkin={checkin} goalOnly={!hasMeals(plan)}
          onSaved={(c) => { setCheckin(c); flash('Le enviamos el resumen a tu profe'); }} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      {adding && (
        <AddEntry foods={foods} mealNames={mealNames} initialMeal={adding.meal} defaultTime={isToday ? nowHHMM() : ''}
          onClose={() => setAdding(null)}
          onAdd={async (row) => { const ok = await insertLogs([row]); if (ok) { setAdding(null); flash(`✓ ${row.name} agregado`); } }} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function CloseDay({ studentId, date, planId, total, target, checkin, onSaved, goalOnly }: {
  studentId: string; date: string; planId: string; total: Macros; target: Macros; checkin: DietCheckin | null; onSaved: (c: DietCheckin) => void; goalOnly?: boolean;
}) {
  const [complied, setComplied] = useState<DietCheckin['complied'] | null>(checkin?.complied ?? null);
  const [comment, setComment] = useState(checkin?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const changed = !!checkin && (Math.round(checkin.total_kcal) !== Math.round(total.kcal) || checkin.complied !== complied || checkin.comment !== comment);

  async function save() {
    if (!complied) return setErr('Elegí cómo te fue.');
    setBusy(true);
    const { data, error } = await supabaseBrowser().from('diet_checkins').upsert({
      student_id: studentId, day: date, plan_id: planId, complied, comment: comment.trim(),
      target_kcal: target.kcal, target_protein: target.protein, target_carbs: target.carbs, target_fat: target.fat,
      total_kcal: r1(total.kcal), total_protein: r1(total.protein), total_carbs: r1(total.carbs), total_fat: r1(total.fat),
    }, { onConflict: 'student_id,day' }).select('*').single();
    setBusy(false);
    if (error) return setErr(error.message);
    setErr(null);
    notify('checkin', (data as DietCheckin).id);
    onSaved(data as DietCheckin);
  }

  return (
    <section className="sheet stack-lg">
      <span className="tape" />
      <div className="row between wrap">
        <h2 className="h-hand">Cerrar el día</h2>
        {checkin && !changed && <span className="stamp green" style={{ fontSize: '.8rem' }}>Enviado</span>}
      </div>
      <p style={{ margin: 0 }}>
        {goalOnly ? 'Diferencia con tu objetivo' : 'Desvío del plan'}: <span className="mark ink" style={{ fontSize: '1.35rem' }}>{deviationText(total, target)}</span>
      </p>
      <div className="stack" style={{ gap: 6 }}>
        <span className="type">{goalOnly ? '¿Llegaste a tu objetivo?' : '¿Pudiste cumplir el plan?'}</span>
        <div className="chips" style={{ flexWrap: 'wrap' }} role="radiogroup" aria-label="¿Pudiste cumplir el plan?">
          {(Object.keys(COMPLIED) as DietCheckin['complied'][]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={complied === k} className={`chip ${complied === k ? 'on' : ''}`} onClick={() => setComplied(k)}>{COMPLIED[k].label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="cday">Comentario para tu profe (opcional)</label>
        <textarea id="cday" className="textarea" value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={complied === 'si' ? '¿Algo para contar?' : 'Qué pasó: un cumpleaños, comí afuera, no tuve tiempo…'} />
      </div>
      {complied && complied !== 'si' && <p className="small muted" style={{ margin: 0 }}>Si comiste algo distinto, cargalo arriba en “Lo que comí” así el desvío es real.</p>}
      {err && <p className="notice red" style={{ margin: 0 }}>{err}</p>}
      <button className="btn primary" disabled={busy || (!!checkin && !changed)} onClick={save}>
        {busy ? <span className="spinner" /> : checkin ? (changed ? 'Actualizar y reenviar' : 'Enviado a tu profe') : 'Enviar a mi profe'}
      </button>
    </section>
  );
}

// ----------------------------------------------------------------------------
type NewLog = Omit<FoodLog, 'id' | 'created_at' | 'student_id' | 'logged_on'>;

function AddEntry({ foods, mealNames, initialMeal, defaultTime, onClose, onAdd }: {
  foods: Food[]; mealNames: string[]; initialMeal: string; defaultTime: string; onClose: () => void; onAdd: (row: NewLog) => void;
}) {
  const [mode, setMode] = useState<'buscar' | 'rapido'>('buscar');
  const [meal, setMeal] = useState(initialMeal);
  const [time, setTime] = useState(defaultTime);
  const [q, setQ] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [quick, setQuick] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [err, setErr] = useState<string | null>(null);
  const results = useMemo(() => searchFoods(foods, q, null).slice(0, 40), [foods, q]);
  const g = num(grams);
  const mac = food && g ? portion(food, g) : null;
  const qp = num(quick.protein) ?? 0, qc = num(quick.carbs) ?? 0, qf = num(quick.fat) ?? 0;
  const qk = num(quick.kcal) ?? Math.round(qp * 4 + qc * 4 + qf * 9);

  function pick(f: Food) { setFood(f); setGrams(String(f.unit_grams ?? 100)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = { logged_at: time || null, meal_label: meal || null, plan_meal_id: null };
    if (mode === 'buscar') {
      if (!food || !g || g <= 0) return setErr('Elegí un alimento y la cantidad.');
      onAdd({ ...base, food_id: food.id, grams: g, name: food.name, kcal: r1(mac!.kcal), protein: r1(mac!.protein), carbs: r1(mac!.carbs), fat: r1(mac!.fat) });
    } else {
      if (!quick.name.trim()) return setErr('Poné qué comiste.');
      if (!qk) return setErr('Cargá las calorías o los macros.');
      onAdd({ ...base, food_id: null, grams: null, name: quick.name.trim(), kcal: qk, protein: qp, carbs: qc, fat: qf });
    }
  }

  return (
    <Modal title="Agregar comida" onClose={onClose}>
      <form className="stack-lg" onSubmit={submit}>
        <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
          <div className="field grow" style={{ minWidth: 150 }}>
            <label htmlFor="am">Comida</label>
            <select id="am" className="select" style={{ fontSize: '1.3rem' }} value={meal} onChange={(e) => setMeal(e.target.value)}>
              {mealNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 120 }}>
            <label htmlFor="at">Hora</label>
            <input id="at" type="time" className="input" style={{ fontSize: '1.3rem' }} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="chips" role="tablist">
          <button type="button" className={`chip ${mode === 'buscar' ? 'on' : ''}`} onClick={() => setMode('buscar')}>Buscar alimento</button>
          <button type="button" className={`chip ${mode === 'rapido' ? 'on' : ''}`} onClick={() => setMode('rapido')}>Agregado rápido</button>
        </div>

        {mode === 'buscar' ? (
          food ? (
            <div className="stack">
              <div className="row between">
                <span><b>{food.name}</b><FoodMacrosLine f={food} /></span>
                <button type="button" className="btn ghost sm" onClick={() => setFood(null)}>Cambiar</button>
              </div>
              <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
                <div className="field" style={{ width: 130 }}>
                  <label htmlFor="ag">Cantidad (g)</label>
                  <input id="ag" className="input" inputMode="decimal" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)} />
                </div>
                {food.unit_name && food.unit_grams && [0.5, 1, 2].map((n) => (
                  <button key={n} type="button" className="chip" onClick={() => setGrams(String(r1(n * food.unit_grams!)))}>
                    {n === 0.5 ? '½' : n} {food.unit_name}
                  </button>
                ))}
              </div>
              {mac && <p className="ink" style={{ margin: 0, fontSize: '1.35rem' }}>{Math.round(mac.kcal)} kcal · P {r1(mac.protein)} · C {r1(mac.carbs)} · G {r1(mac.fat)}</p>}
            </div>
          ) : (
            <div className="stack">
              <label className="row">
                <IconSearch />
                <input className="input" autoFocus placeholder="Buscar: huevo, arroz, yogur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alimento" />
              </label>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '38dvh', overflow: 'auto' }}>
                {results.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => pick(f)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--rule)', padding: '8px 0', cursor: 'pointer' }}>
                      {f.name}<FoodMacrosLine f={f} />
                    </button>
                  </li>
                ))}
                {!results.length && <li className="muted" style={{ padding: 10 }}>No está en la base. Usá “Agregado rápido”.</li>}
              </ul>
            </div>
          )
        ) : (
          <div className="stack">
            <div className="field"><label htmlFor="qn">Qué comiste</label><input id="qn" className="input" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} placeholder="Ej: 2 porciones de pizza en lo de un amigo" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              <div className="field"><label htmlFor="qk">kcal</label><input id="qk" className="input" inputMode="decimal" value={quick.kcal} placeholder={qk ? String(qk) : ''} onChange={(e) => setQuick({ ...quick, kcal: e.target.value })} /></div>
              <div className="field"><label htmlFor="qp">Prot. g</label><input id="qp" className="input" inputMode="decimal" value={quick.protein} onChange={(e) => setQuick({ ...quick, protein: e.target.value })} /></div>
              <div className="field"><label htmlFor="qc">Carb. g</label><input id="qc" className="input" inputMode="decimal" value={quick.carbs} onChange={(e) => setQuick({ ...quick, carbs: e.target.value })} /></div>
              <div className="field"><label htmlFor="qf">Grasa g</label><input id="qf" className="input" inputMode="decimal" value={quick.fat} onChange={(e) => setQuick({ ...quick, fat: e.target.value })} /></div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Si no sabés los macros, cargá sólo las calorías aproximadas (las ves en la etiqueta o en una app).</p>
          </div>
        )}
        {err && <p className="notice red" style={{ margin: 0 }}>{err}</p>}
        <button className="btn primary">Agregar</button>
      </form>
    </Modal>
  );
}
