'use client';
import { useEffect, useRef, useState } from 'react';

export type Rest = { endAt: number; total: number; label: string } | null;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sin audio */ }
}

/** Temporizador de descanso fijo abajo de la pantalla. Mantiene la pantalla encendida mientras corre. */
export default function RestTimer({ rest, onChange }: { rest: Rest; onChange: (r: Rest) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const fired = useRef<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!rest) return;
    setDone(false);
    fired.current = null;
    const t = setInterval(() => setNow(Date.now()), 250);
    // Mantener la pantalla encendida durante el descanso (si el navegador lo permite)
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen').then((l) => { lock.current = l; }).catch(() => {});
    return () => { clearInterval(t); lock.current?.release().catch(() => {}); lock.current = null; };
  }, [rest]);

  const left = rest ? Math.max(0, Math.ceil((rest.endAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.endAt) return;
    fired.current = rest.endAt;
    setDone(true);
    navigator.vibrate?.([250, 120, 250, 120, 400]);
    beep();
    const t = setTimeout(() => { onChange(null); setDone(false); }, 6000);
    return () => clearTimeout(t);
  }, [left, rest, onChange]);

  if (!rest) return null;
  const pct = Math.min(100, ((rest.total - left) / rest.total) * 100);
  const add = (s: number) => onChange({ ...rest, endAt: Math.max(Date.now() + 1000, rest.endAt + s * 1000), total: Math.max(5, rest.total + s) });

  return (
    <div className={`rest-timer ${done ? 'done' : ''}`} role="timer" aria-live="polite" aria-label="Descanso">
      <div className="rest-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <div className="rest-in">
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="type">{done ? '¡Descanso terminado!' : `Descanso · ${rest.label}`}</span>
          <div className="rest-time">{done ? 'A la próxima serie 💪' : fmt(left)}</div>
        </div>
        {!done && (
          <>
            <button className="btn sm" onClick={() => add(-15)} aria-label="Restar 15 segundos">−15</button>
            <button className="btn sm" onClick={() => add(15)} aria-label="Sumar 15 segundos">+15</button>
          </>
        )}
        <button className="btn sm primary" onClick={() => onChange(null)}>{done ? 'OK' : 'Saltear'}</button>
      </div>
    </div>
  );
}
