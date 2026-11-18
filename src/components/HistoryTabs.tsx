'use client';
import { useState } from 'react';
import type { FullRoutine, Measurement, SetLog } from '@/lib/types';
import { MeasurementsHistory, TrainingHistory } from './History';

export default function HistoryTabs({ routine, logs, measurements }: { routine: FullRoutine | null; logs: SetLog[]; measurements: Measurement[] }) {
  const [tab, setTab] = useState<'ent' | 'med'>('ent');
  return (
    <div className="stack-lg">
      <div className="chips" role="tablist">
        <button role="tab" aria-selected={tab === 'ent'} className={`chip ${tab === 'ent' ? 'on' : ''}`} onClick={() => setTab('ent')}>Entrenamiento (semanal)</button>
        <button role="tab" aria-selected={tab === 'med'} className={`chip ${tab === 'med' ? 'on' : ''}`} onClick={() => setTab('med')}>Medidas (cada 2 semanas)</button>
      </div>
      {tab === 'ent' ? (
        routine ? <TrainingHistory routine={routine} logs={logs} /> : <div className="sheet plain empty">Sin rutina publicada.</div>
      ) : (
        <MeasurementsHistory items={measurements} />
      )}
    </div>
  );
}
