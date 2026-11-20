'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Food } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { RECIPES_CATEGORY, asFood } from '@/lib/foodSources';
import { portion, r1, sum } from '@/lib/nutrition';
import { num } from '@/lib/utils';
import Modal from './Modal';
import { searchFoods } from './FoodPicker';
import { IconSearch, IconTrash } from './Icons';

type Ing = { food: Food; grams: string };

/**
 * Crea o edita una receta a partir de varios alimentos de la base.
 * Los valores se guardan cada 100 g; la porción es el peso total ÷ porciones.
 */
export default function RecipeEditor({ foods, recipe, onClose, onSaved, onDeleted }: {
  foods: Food[]; recipe?: Food | null; onClose: () => void; onSaved: (f: Food) => void; onDeleted?: (id: string) => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [ings, setIngs] = useState<Ing[]>([]);
  const [cooked, setCooked] = useState(recipe?.recipe_total_grams?.toString() ?? '');
  const [portions, setPortions] = useState(recipe?.recipe_portions?.toString() ?? '1');
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();

  // Al editar: cargar los ingredientes guardados
  useEffect(() => {
    if (!recipe) return;
    sb.from('recipe_items').select('*, food:foods!recipe_items_food_id_fkey(*)').eq('recipe_id', recipe.id).order('position')
      .then(({ data }) => setIngs(((data ?? []) as { grams: number; food: Food }[]).map((x) => ({ food: asFood(x.food), grams: String(Number(x.grams)) }))));
  }, [recipe, sb]);

  const usable = useMemo(() => foods.filter((f) => f.id !== recipe?.id), [foods, recipe]);
  const results = useMemo(() => (q.trim() ? searchFoods(usable, q, null).slice(0, 8) : []), [usable, q]);
  const rawGrams = ings.reduce((s, i) => s + (num(i.grams) ?? 0), 0);
  const total = sum(ings.map((i) => portion(i.food, num(i.grams) ?? 0)));
  const weight = num(cooked) ?? rawGrams;
  const per100 = weight > 0 ? { kcal: (total.kcal / weight) * 100, protein: (total.protein / weight) * 100, carbs: (total.carbs / weight) * 100, fat: (total.fat / weight) * 100 } : null;
  const nPort = Math.max(1, Math.round(num(portions) ?? 1));
  const portionGrams = weight > 0 ? weight / nPort : 0;

  function add(f: Food) {
    setIngs((l) => [...l, { food: f, grams: String(f.unit_grams ?? 100) }]);
    setQ('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('Ponele un nombre a la receta.');
    if (!ings.length || !per100) return setErr('Agregá al menos un ingrediente con su cantidad.');
    setBusy(true);
    setErr(null);
    const row = {
      name: name.trim(), category: RECIPES_CATEGORY, kind: 'receta' as const,
      kcal: r1(per100.kcal), protein: r1(per100.protein), carbs: r1(per100.carbs), fat: r1(per100.fat),
      unit_name: 'porción', unit_grams: r1(portionGrams), recipe_total_grams: r1(weight), recipe_portions: nPort,
    };
    const res = recipe
      ? await sb.from('foods').update(row).eq('id', recipe.id).select('*').single()
      : await sb.from('foods').insert(row).select('*').single();
    if (res.error) { setBusy(false); return setErr(res.error.message.includes('duplicate') ? 'Ya existe un alimento con ese nombre.' : res.error.message); }
    const saved = asFood(res.data as Food);
    if (recipe) await sb.from('recipe_items').delete().eq('recipe_id', saved.id);
    const { error } = await sb.from('recipe_items').insert(ings.map((i, k) => ({ recipe_id: saved.id, food_id: i.food.id, grams: num(i.grams) ?? 0, position: k })));
    setBusy(false);
    if (error) return setErr('La receta se guardó pero no sus ingredientes: ' + error.message);
    onSaved(saved);
  }

  return (
    <Modal title={recipe ? 'Editar receta' : 'Nueva receta'} onClose={onClose} wide>
      <form className="stack-lg" onSubmit={save}>
        <div className="field"><label htmlFor="rn">Nombre</label><input id="rn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Panqueques de avena y banana" /></div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="type">Ingredientes</span>
          {ings.map((i, k) => {
            const m = portion(i.food, num(i.grams) ?? 0);
            return (
              <div key={k} className="row" style={{ borderBottom: '1px solid var(--rule)', padding: '4px 0', gap: 8 }}>
                <span className="grow" style={{ minWidth: 0 }}>{i.food.name}<span className="type" style={{ display: 'block' }}>{Math.round(m.kcal)} kcal · P {r1(m.protein)} · C {r1(m.carbs)} · G {r1(m.fat)}</span></span>
                <input className="grams-in" inputMode="decimal" value={i.grams} aria-label={`Gramos de ${i.food.name}`}
                  onChange={(e) => setIngs((l) => l.map((x, j) => (j === k ? { ...x, grams: e.target.value } : x)))} /> g
                <button type="button" className="icon-btn" style={{ border: 0, width: 32, height: 32 }} onClick={() => setIngs((l) => l.filter((_, j) => j !== k))} aria-label={`Quitar ${i.food.name}`}><IconTrash size={16} /></button>
              </div>
            );
          })}
          <label className="row">
            <IconSearch />
            <input className="input" style={{ fontSize: '1.25rem' }} placeholder="Agregar ingrediente: avena, huevo, banana…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ingrediente" />
          </label>
          {results.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1.5px solid var(--line)', borderRadius: 8, maxHeight: 220, overflow: 'auto' }}>
              {results.map((f) => (
                <li key={f.id}><button type="button" onClick={() => add(f)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--rule)', padding: '8px 10px', cursor: 'pointer' }}>
                  {f.name} <span className="type">· {Math.round(f.kcal)} kcal c/100 g</span>
                </button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="row wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 190 }}>
            <label htmlFor="rc">Peso final (g)</label>
            <input id="rc" className="input" inputMode="decimal" value={cooked} onChange={(e) => setCooked(e.target.value)} placeholder={rawGrams ? String(Math.round(rawGrams)) : 'opcional'} />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label htmlFor="rp">Porciones</label>
            <input id="rp" className="input" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>El peso final es opcional: usalo si la receta pierde o gana agua al cocinarse (por ejemplo, un guiso). Si lo dejás vacío se usa la suma de los ingredientes.</p>

        {per100 && (
          <div className="sheet plain grid-paper" style={{ padding: 14 }}>
            <div className="macros-line"><span className="kcal">{Math.round(total.kcal)} kcal</span> en total · {Math.round(weight)} g</div>
            <div className="macros-line">Cada 100 g: <b>{Math.round(per100.kcal)} kcal</b> · P <b>{r1(per100.protein)}</b> · C <b>{r1(per100.carbs)}</b> · G <b>{r1(per100.fat)}</b></div>
            <div className="macros-line">1 porción ({Math.round(portionGrams)} g): <b>{Math.round(total.kcal / nPort)} kcal</b> · P <b>{r1(total.protein / nPort)}</b> · C <b>{r1(total.carbs / nPort)}</b> · G <b>{r1(total.fat / nPort)}</b></div>
          </div>
        )}
        {err && <p className="notice red" style={{ margin: 0 }}>{err}</p>}
        <div className="row wrap">
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : recipe ? 'Guardar cambios' : 'Crear receta'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          {recipe && onDeleted && (
            <button type="button" className="btn ghost" style={{ color: 'var(--red)' }} disabled={busy} onClick={async () => {
              if (!confirm(`¿Borrar la receta “${recipe.name}”?`)) return;
              const { error } = await sb.from('foods').delete().eq('id', recipe.id);
              if (error) return setErr(error.message.includes('foreign key') ? 'No se puede borrar: está usada en un plan, otra receta o el diario de alguien.' : error.message);
              onDeleted(recipe.id);
            }}>Borrar receta</button>
          )}
        </div>
      </form>
    </Modal>
  );
}
