'use client';
import { useState } from 'react';
import type { Level, TrainingInfo } from '@/lib/types';
import { LEVELS } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';

export function levelLabel(l: Level | null | undefined) {
  return LEVELS.find((x) => x.key === l)?.label ?? 'Sin nivel';
}

/** Nivel del alumno: lo carga y lo ve sólo el profe. */
export function LevelChips({ value, onChange, disabled }: { value: Level | null; onChange: (l: Level) => void; disabled?: boolean }) {
  return (
    <div className="chips" role="radiogroup" aria-label="Nivel del alumno">
      {LEVELS.map((l) => (
        <button key={l.key} type="button" role="radio" aria-checked={value === l.key} disabled={disabled}
          className={`chip ${value === l.key ? 'on' : ''}`} onClick={() => onChange(l.key)} title={l.hint}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export async function saveTrainingInfo(studentId: string, fields: Partial<Pick<TrainingInfo, 'level' | 'notes' | 'sex' | 'height_cm' | 'activity'>>) {
  return supabaseBrowser()
    .from('student_training_info')
    .upsert({ student_id: studentId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'student_id' });
}

export default function TrainingInfoForm({ studentId, initial, onSaved }: { studentId: string; initial: TrainingInfo | null; onSaved?: (i: Pick<TrainingInfo, 'level' | 'notes'>) => void }) {
  const [level, setLevel] = useState<Level | null>(initial?.level ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e?: React.FormEvent, nextLevel = level) {
    e?.preventDefault();
    setBusy(true);
    const { error } = await saveTrainingInfo(studentId, { level: nextLevel, notes });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Guardado.' });
    if (!error) onSaved?.({ level: nextLevel, notes });
  }

  return (
    <form className="sheet stack-lg" onSubmit={save}>
      <span className="tape" />
      <div className="row between wrap">
        <h2 className="h-hand">Nivel y notas</h2>
        <span className="tag ink">sólo lo ves vos</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="type">Nivel de entrenamiento</span>
        <LevelChips value={level} disabled={busy} onChange={(l) => { setLevel(l); save(undefined, l); }} />
        <span className="small muted">{LEVELS.find((l) => l.key === level)?.hint ?? 'Elegí uno: la revisión con IA lo usa para evaluar la rutina.'}</span>
      </div>
      <div className="field">
        <label htmlFor="tnotes">Notas privadas</label>
        <textarea id="tnotes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Lesiones, molestias, experiencia previa, días disponibles, preferencias…" />
        <span className="small muted">La IA también las tiene en cuenta al revisar la rutina.</span>
      </div>
      {msg && <p className={`notice ${msg.ok ? 'green' : 'red'}`}>{msg.text}</p>}
      <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Guardar notas'}</button>
    </form>
  );
}
