'use client';
import { useMemo, useState } from 'react';
import type { Food } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { num } from '@/lib/utils';
import Modal from '@/components/Modal';
import { searchFoods } from '@/components/FoodPicker';
import { IconSearch } from '@/components/Icons';
import RecipeEditor from '@/components/RecipeEditor';
import BarcodeScanner from '@/components/BarcodeScanner';
import { foodOrigin } from '@/lib/foodSources';

export default function FoodCatalog({ initial }: { initial: Food[] }) {
  const [list, setList] = useState(initial);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [edit, setEdit] = useState<Food | 'new' | null>(null);
  const [recipe, setRecipe] = useState<Food | 'new' | null>(null);
  const [scan, setScan] = useState(false);
  const upsert = (f: Food) => setList((l) => (l.some((x) => x.id === f.id) ? l.map((x) => (x.id === f.id ? f : x)) : [...l, f]));
  const cats = useMemo(() => [...new Set(list.map((f) => f.category))].sort((a, b) => a.localeCompare(b, 'es')), [list]);
  const results = useMemo(() => searchFoods(list, q, cat), [list, q, cat]);

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <div>
          <h1 className="h-hand">Base de alimentos</h1>
          <p className="type" style={{ margin: 0 }}>{list.length} alimentos · valores cada 100 g (bebidas cada 100 ml)</p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setScan(true)}>▥ Escanear código</button>
          <button className="btn" onClick={() => setRecipe('new')}>＋ Nueva receta</button>
          <button className="btn primary" onClick={() => setEdit('new')}>+ Nuevo alimento</button>
        </div>
      </div>
      <label className="row" style={{ maxWidth: 520 }}>
        <IconSearch />
        <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alimento" />
      </label>
      <div className="chips">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>Todos</button>
        {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? null : c)}>{c}</button>)}
      </div>
      <section className="sheet plain scroll-x">
        <table className="ledger">
          <thead><tr><th>Alimento</th><th className="hide-mobile">Categoría</th><th>kcal</th><th>Prot.</th><th>Carbos</th><th>Grasas</th><th className="hide-mobile">Porción</th><th className="hide-mobile">Creado por</th></tr></thead>
          <tbody>
            {results.map((f) => (
              <tr key={f.id} onClick={() => (f.kind === 'receta' ? setRecipe(f) : setEdit(f))} style={{ cursor: 'pointer' }}>
                <td><b>{f.name}</b>{foodOrigin(f) && <span className="food-origin hide-desktop">{foodOrigin(f)}</span>}</td>
                <td className="type hide-mobile">{f.category}</td>
                <td className="ink" style={{ fontSize: '1.2rem' }}>{Math.round(f.kcal)}</td>
                <td>{f.protein}</td><td>{f.carbs}</td><td>{f.fat}</td>
                <td className="type hide-mobile">{f.unit_name ? `1 ${f.unit_name} = ${f.unit_grams} g` : '—'}</td>
                <td className="small hide-mobile">{f.creator_name ? <>{f.creator_name} <span className={`tag ${f.creator_role === 'student' ? 'amber' : 'ink'}`}>{f.creator_role === 'student' ? 'alumno' : 'profe'}</span></> : <span className="muted">Base</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!results.length && <p className="empty">Sin resultados.</p>}
      </section>
      {recipe && (
        <RecipeEditor foods={list} recipe={recipe === 'new' ? null : recipe} onClose={() => setRecipe(null)} onSaved={(f) => { upsert(f); setRecipe(null); }} onDeleted={(id) => { setList((l) => l.filter((x) => x.id !== id)); setRecipe(null); }} />
      )}
      {scan && <BarcodeScanner onClose={() => setScan(false)} onFood={(f) => { upsert(f); setScan(false); setQ(f.name); }} />}
      {edit && (
        <EditFood food={edit === 'new' ? null : edit} cats={cats} defaultName={edit === 'new' ? q : ''} onClose={() => setEdit(null)}
          onSaved={(f) => { setList((l) => (l.some((x) => x.id === f.id) ? l.map((x) => (x.id === f.id ? f : x)) : [...l, f])); setEdit(null); }}
          onDeleted={(id) => { setList((l) => l.filter((x) => x.id !== id)); setEdit(null); }} />
      )}
    </div>
  );
}

function EditFood({ food, cats, defaultName, onClose, onSaved, onDeleted }: {
  food: Food | null; cats: string[]; defaultName: string; onClose: () => void; onSaved: (f: Food) => void; onDeleted: (id: string) => void;
}) {
  const [f, setF] = useState({
    name: food?.name ?? defaultName, category: food?.category ?? '', kcal: food?.kcal?.toString() ?? '', protein: food?.protein?.toString() ?? '',
    carbs: food?.carbs?.toString() ?? '', fat: food?.fat?.toString() ?? '', unit_name: food?.unit_name ?? '', unit_grams: food?.unit_grams?.toString() ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = num(f.protein) ?? 0, c = num(f.carbs) ?? 0, g = num(f.fat) ?? 0;
  const calc = Math.round(p * 4 + c * 4 + g * 9);
  const kcal = num(f.kcal);
  const mismatch = kcal != null && Math.abs(calc - kcal) > Math.max(25, kcal * 0.15);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (kcal == null) return setErr('Completá las calorías (podés usar las calculadas desde los macros).');
    if (!!f.unit_name.trim() !== !!num(f.unit_grams)) return setErr('Para la porción casera completá el nombre y los gramos, o dejá los dos vacíos.');
    setBusy(true);
    const row = {
      name: f.name.trim(), category: f.category.trim() || 'Otros', kcal, protein: p, carbs: c, fat: g,
      unit_name: f.unit_name.trim() || null, unit_grams: num(f.unit_grams),
    };
    const sb = supabaseBrowser();
    const res = food ? await sb.from('foods').update(row).eq('id', food.id).select('*').single() : await sb.from('foods').insert(row).select('*').single();
    setBusy(false);
    if (res.error) return setErr(res.error.message.includes('duplicate') ? 'Ya existe un alimento con ese nombre.' : res.error.message);
    const d = res.data as Food;
    onSaved({ ...d, kcal: Number(d.kcal), protein: Number(d.protein), carbs: Number(d.carbs), fat: Number(d.fat), unit_grams: d.unit_grams == null ? null : Number(d.unit_grams) });
  }

  async function remove() {
    if (!food || !confirm(`¿Borrar ${food.name}?`)) return;
    const { error } = await supabaseBrowser().from('foods').delete().eq('id', food.id);
    if (error) return setErr(error.message.includes('foreign key') ? 'No se puede borrar: está usado en algún plan o registro.' : error.message);
    onDeleted(food.id);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={food ? 'Editar alimento' : 'Nuevo alimento'} onClose={onClose}>
      <form className="stack-lg" onSubmit={save}>
        <div className="field"><label htmlFor="fn">Nombre</label><input id="fn" className="input" required value={f.name} onChange={set('name')} placeholder="Ej: Pechuga de pollo cocida" /></div>
        <div className="field"><label htmlFor="fc">Categoría</label><input id="fc" className="input" list="fcats" value={f.category} onChange={set('category')} /><datalist id="fcats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
        <span className="type">Valores cada 100 g</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px 16px' }}>
          <div className="field"><label htmlFor="fk">kcal</label><input id="fk" className="input" inputMode="decimal" value={f.kcal} onChange={set('kcal')} placeholder={calc ? String(calc) : ''} /></div>
          <div className="field"><label htmlFor="fp">Proteína (g)</label><input id="fp" className="input" inputMode="decimal" value={f.protein} onChange={set('protein')} /></div>
          <div className="field"><label htmlFor="fcb">Carbos (g)</label><input id="fcb" className="input" inputMode="decimal" value={f.carbs} onChange={set('carbs')} /></div>
          <div className="field"><label htmlFor="fg">Grasas (g)</label><input id="fg" className="input" inputMode="decimal" value={f.fat} onChange={set('fat')} /></div>
        </div>
        {calc > 0 && (
          <p className={`small ${mismatch ? 'notice amber' : 'muted'}`} style={{ margin: 0 }}>
            Según los macros serían {calc} kcal.{mismatch ? ' Revisá los valores: no coinciden con las calorías.' : ''}{' '}
            {kcal == null && <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, kcal: String(calc) })}>Usar {calc}</button>}
          </p>
        )}
        <span className="type">Porción casera (opcional)</span>
        <div className="row" style={{ gap: 16 }}>
          <div className="field grow"><label htmlFor="fun">Nombre</label><input id="fun" className="input" value={f.unit_name} onChange={set('unit_name')} placeholder="unidad, taza, feta…" /></div>
          <div className="field" style={{ width: 120 }}><label htmlFor="fug">Gramos</label><input id="fug" className="input" inputMode="decimal" value={f.unit_grams} onChange={set('unit_grams')} /></div>
        </div>
        {err && <p className="notice red">{err}</p>}
        <div className="row wrap">
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Guardar'}</button>
          {food && <button type="button" className="btn ghost" style={{ color: 'var(--red)' }} onClick={remove}>Borrar</button>}
        </div>
      </form>
    </Modal>
  );
}
