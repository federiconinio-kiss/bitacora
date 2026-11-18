'use client';
import { useMemo, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import Modal from './Modal';
import VideoButton from './VideoButton';
import { IconSearch } from './Icons';

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda instantánea: todas las palabras deben aparecer en nombre, grupo o equipamiento. */
export function searchExercises(list: Exercise[], q: string, group: string | null) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return list
    .filter((e) => !group || e.muscle_group === group)
    .filter((e) => {
      const hay = norm(`${e.name} ${e.muscle_group} ${e.equipment}`);
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => {
      const qa = norm(a.name).startsWith(norm(q)) ? 0 : 1;
      const qb = norm(b.name).startsWith(norm(q)) ? 0 : 1;
      return qa - qb || a.name.localeCompare(b.name, 'es');
    });
}

export default function ExercisePicker({ exercises, title, initialGroup = null, exclude = [], onPick, onClose, onCreated }: {
  exercises: Exercise[]; title: string; initialGroup?: string | null; exclude?: string[];
  onPick: (e: Exercise) => void; onClose: () => void; onCreated?: (e: Exercise) => void;
}) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(initialGroup);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const groups = useMemo(() => [...new Set(exercises.map((e) => e.muscle_group))], [exercises]);
  const results = useMemo(() => searchExercises(exercises, q, group).filter((e) => !exclude.includes(e.id)), [exercises, q, group, exclude]);

  async function create() {
    setCreating(true);
    setErr(null);
    const { data, error } = await supabaseBrowser()
      .from('exercises')
      .insert({ name: q.trim(), muscle_group: group ?? 'Otros', equipment: '' })
      .select('*').single();
    setCreating(false);
    if (error) return setErr(error.message.includes('duplicate') ? 'Ya existe un ejercicio con ese nombre.' : error.message);
    onCreated?.(data as Exercise);
    onPick(data as Exercise);
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="stack">
        <label className="row">
          <IconSearch />
          <input autoFocus className="input" placeholder="Ej: press inclinado, remo, polea…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
        </label>
        <div className="chips">
          <button className={`chip ${!group ? 'on' : ''}`} onClick={() => setGroup(null)}>Todos</button>
          {groups.map((g) => <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(g === group ? null : g)}>{g}</button>)}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '52dvh', overflow: 'auto' }}>
          {results.slice(0, 80).map((e) => (
            <li key={e.id} className="row" style={{ borderBottom: '1px solid var(--rule)', padding: '6px 0', gap: 8 }}>
              <button className="grow" onClick={() => onPick(e)} style={{ textAlign: 'left', background: 'none', border: 0, padding: '4px 0', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.1rem' }}>{e.name}</span>
                <span className="type" style={{ display: 'block' }}>{e.muscle_group} · {e.equipment || '—'}{e.video_url ? ' · 🎬' : ''}</span>
              </button>
              <VideoButton exercise={e} label="" />
              <button className="btn sm primary" onClick={() => onPick(e)}>Elegir</button>
            </li>
          ))}
          {!results.length && <li className="muted" style={{ padding: 12 }}>No hay resultados.</li>}
        </ul>
        {q.trim().length > 2 && !results.some((r) => norm(r.name) === norm(q.trim())) && (
          <div className="notice">
            ¿No está? <button className="btn sm" disabled={creating} onClick={create}>Crear “{q.trim()}”{group ? ` en ${group}` : ''}</button>
            <span className="small muted"> Después podés sumarle el video desde “Ejercicios”.</span>
          </div>
        )}
        {err && <p className="notice red">{err}</p>}
      </div>
    </Modal>
  );
}
