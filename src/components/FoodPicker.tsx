'use client';
import { useMemo, useState } from 'react';
import type { Food } from '@/lib/types';
import Modal from './Modal';
import { IconSearch } from './Icons';
import { norm } from './ExercisePicker';

export function searchFoods(list: Food[], q: string, cat: string | null) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return list
    .filter((f) => !cat || f.category === cat)
    .filter((f) => { const hay = norm(`${f.name} ${f.category}`); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => {
      const qa = norm(a.name).startsWith(norm(q)) ? 0 : 1;
      const qb = norm(b.name).startsWith(norm(q)) ? 0 : 1;
      return qa - qb || a.name.localeCompare(b.name, 'es');
    });
}

export function FoodMacrosLine({ f }: { f: Food }) {
  return (
    <span className="type" style={{ display: 'block' }}>
      {f.category} · c/100 g: {Math.round(f.kcal)} kcal · P {f.protein} · C {f.carbs} · G {f.fat}
      {f.unit_name && f.unit_grams ? ` · 1 ${f.unit_name} = ${f.unit_grams} g` : ''}
    </span>
  );
}

export default function FoodPicker({ foods, title, onPick, onClose }: { foods: Food[]; title: string; onPick: (f: Food) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const cats = useMemo(() => [...new Set(foods.map((f) => f.category))].sort((a, b) => a.localeCompare(b, 'es')), [foods]);
  const results = useMemo(() => searchFoods(foods, q, cat), [foods, q, cat]);
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="stack">
        <label className="row">
          <IconSearch />
          <input autoFocus className="input" placeholder="Ej: pollo, arroz, banana, yogur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alimento" />
        </label>
        <div className="chips">
          <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>Todos</button>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c === cat ? null : c)}>{c}</button>)}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '52dvh', overflow: 'auto' }}>
          {results.slice(0, 100).map((f) => (
            <li key={f.id} className="row" style={{ borderBottom: '1px solid var(--rule)', padding: '6px 0', gap: 8 }}>
              <button className="grow" onClick={() => onPick(f)} style={{ textAlign: 'left', background: 'none', border: 0, padding: '4px 0', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.08rem' }}>{f.name}</span>
                <FoodMacrosLine f={f} />
              </button>
              <button className="btn sm primary" onClick={() => onPick(f)}>Elegir</button>
            </li>
          ))}
          {!results.length && <li className="muted" style={{ padding: 12 }}>No hay resultados. Podés sumarlo en “Alimentos”.</li>}
        </ul>
      </div>
    </Modal>
  );
}
