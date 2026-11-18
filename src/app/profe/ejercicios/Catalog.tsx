'use client';
import { useMemo, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { youtubeId, youtubeSearchUrl } from '@/lib/utils';
import Modal from '@/components/Modal';
import { ExerciseVideo } from '@/components/VideoButton';
import { searchExercises } from '@/components/ExercisePicker';
import { IconSearch } from '@/components/Icons';

const EQUIP = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Smith', 'Peso corporal', 'Banco', 'Kettlebell', 'Accesorio'];

export default function Catalog({ initial }: { initial: Exercise[] }) {
  const [list, setList] = useState(initial);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [onlyNoVideo, setOnlyNoVideo] = useState(false);
  const [edit, setEdit] = useState<Exercise | 'new' | null>(null);
  const groups = useMemo(() => [...new Set(list.map((e) => e.muscle_group))].sort((a, b) => a.localeCompare(b, 'es')), [list]);
  const results = useMemo(() => searchExercises(list, q, group).filter((e) => !onlyNoVideo || !youtubeId(e.video_url)), [list, q, group, onlyNoVideo]);
  const withVideo = list.filter((e) => youtubeId(e.video_url)).length;

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <div>
          <h1 className="h-hand">Biblioteca de ejercicios</h1>
          <p className="type" style={{ margin: 0 }}>{list.length} ejercicios · {withVideo} con video elegido</p>
        </div>
        <button className="btn primary" onClick={() => setEdit('new')}>+ Nuevo ejercicio</button>
      </div>
      <label className="row" style={{ maxWidth: 520 }}>
        <IconSearch />
        <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
      </label>
      <div className="chips">
        <button className={`chip ${!group ? 'on' : ''}`} onClick={() => setGroup(null)}>Todos</button>
        {groups.map((g) => <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>{g}</button>)}
        <button className={`chip ${onlyNoVideo ? 'on' : ''}`} onClick={() => setOnlyNoVideo(!onlyNoVideo)}>Sin video</button>
      </div>

      <section className="sheet plain scroll-x">
        <table className="ledger">
          <thead><tr><th>Ejercicio</th><th>Grupo</th><th className="hide-mobile">Equipo</th><th>Video</th></tr></thead>
          <tbody>
            {results.map((e) => (
              <tr key={e.id} onClick={() => setEdit(e)} style={{ cursor: 'pointer' }}>
                <td><b>{e.name}</b>{e.cues && <div className="small muted hide-mobile">{e.cues}</div>}</td>
                <td className="type">{e.muscle_group}</td>
                <td className="type hide-mobile">{e.equipment}</td>
                <td>{youtubeId(e.video_url) ? <span className="tag green">elegido</span> : <span className="tag amber">buscar</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!results.length && <p className="empty">Sin resultados.</p>}
      </section>

      {edit && (
        <EditExercise
          ex={edit === 'new' ? null : edit}
          groups={groups}
          defaultName={edit === 'new' ? q : ''}
          onClose={() => setEdit(null)}
          onSaved={(x) => { setList((l) => (l.some((y) => y.id === x.id) ? l.map((y) => (y.id === x.id ? x : y)) : [...l, x])); setEdit(x); }}
          onDeleted={(id) => { setList((l) => l.filter((y) => y.id !== id)); setEdit(null); }}
        />
      )}
    </div>
  );
}

function EditExercise({ ex, groups, defaultName, onClose, onSaved, onDeleted }: {
  ex: Exercise | null; groups: string[]; defaultName: string; onClose: () => void; onSaved: (e: Exercise) => void; onDeleted: (id: string) => void;
}) {
  const [f, setF] = useState({
    name: ex?.name ?? defaultName, muscle_group: ex?.muscle_group ?? groups[0] ?? '', equipment: ex?.equipment ?? '',
    video_url: ex?.video_url ?? '', cues: ex?.cues ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const videoOk = !f.video_url || youtubeId(f.video_url) || /^https?:\/\//.test(f.video_url);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!videoOk) return setErr('El link de video no parece válido.');
    setBusy(true);
    setErr(null);
    const row = { ...f, name: f.name.trim(), muscle_group: f.muscle_group.trim() || 'Otros', video_url: f.video_url.trim() || null, cues: f.cues.trim() || null };
    const sb = supabaseBrowser();
    const res = ex ? await sb.from('exercises').update(row).eq('id', ex.id).select('*').single() : await sb.from('exercises').insert(row).select('*').single();
    setBusy(false);
    if (res.error) return setErr(res.error.message.includes('duplicate') ? 'Ya existe un ejercicio con ese nombre.' : res.error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved(res.data as Exercise);
  }

  async function remove() {
    if (!ex || !confirm(`¿Borrar ${ex.name} de la biblioteca?`)) return;
    const { error } = await supabaseBrowser().from('exercises').delete().eq('id', ex.id);
    if (error) return setErr(error.message.includes('foreign key') ? 'No se puede borrar: está usado en alguna rutina o historial.' : error.message);
    onDeleted(ex.id);
  }

  return (
    <Modal title={ex ? 'Editar ejercicio' : 'Nuevo ejercicio'} onClose={onClose} wide>
      <div className="grid-2">
        <form className="stack-lg" onSubmit={save}>
          <div className="field"><label htmlFor="xn">Nombre</label><input id="xn" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="row" style={{ gap: 14 }}>
            <div className="field grow"><label htmlFor="xg">Grupo muscular</label>
              <input id="xg" className="input" list="groups" value={f.muscle_group} onChange={(e) => setF({ ...f, muscle_group: e.target.value })} />
              <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
            <div className="field grow"><label htmlFor="xe">Equipamiento</label>
              <input id="xe" className="input" list="equip" value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} />
              <datalist id="equip">{EQUIP.map((g) => <option key={g} value={g} />)}</datalist></div>
          </div>
          <div className="field">
            <label htmlFor="xv">Link del video (YouTube)</label>
            <input id="xv" className="input" style={{ fontSize: '1.15rem' }} placeholder="https://youtu.be/…" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} />
            <a className="small" href={youtubeSearchUrl(f.name || 'ejercicio')} target="_blank" rel="noreferrer">Buscar “{f.name || '…'}” en YouTube ↗</a>
            <span className="small muted">Elegí el video, copiá su link y pegalo acá. Podés usar tus propios videos.</span>
          </div>
          <div className="field"><label htmlFor="xc">Cómo hacerlo (pauta técnica)</label><textarea id="xc" className="textarea" value={f.cues} onChange={(e) => setF({ ...f, cues: e.target.value })} /></div>
          {err && <p className="notice red">{err}</p>}
          <div className="row wrap">
            <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : saved ? '✓ Guardado' : 'Guardar'}</button>
            {ex && <button type="button" className="btn ghost" style={{ color: 'var(--red)' }} onClick={remove}>Borrar</button>}
          </div>
        </form>
        <div>
          <span className="type">Así lo ve el alumno</span>
          <div style={{ marginTop: 8 }}>
            <ExerciseVideo exercise={{ id: ex?.id ?? 'new', name: f.name, muscle_group: f.muscle_group, equipment: f.equipment, video_url: f.video_url || null, cues: f.cues || null }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
