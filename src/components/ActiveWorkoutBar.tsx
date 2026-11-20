'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fmtDuration, readActive, type ActiveWorkout } from '@/lib/workout';

/** Barra "entrenamiento en curso" en las otras secciones, para volver con un toque. */
export default function ActiveWorkoutBar() {
  const path = usePathname();
  const [a, setA] = useState<ActiveWorkout | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const read = () => setA(readActive());
    read();
    window.addEventListener('ecf:active-workout', read);
    window.addEventListener('storage', read);
    const t = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => { window.removeEventListener('ecf:active-workout', read); window.removeEventListener('storage', read); clearInterval(t); };
  }, [path]);

  if (!a || path.startsWith(`/alumno/dia/${a.dayId}`)) return null;
  const ms = now - new Date(a.startedAt).getTime();
  if (ms > 24 * 3600 * 1000) return null; // sesión vieja olvidada: no molestar
  const stale = ms > 90 * 60 * 1000;
  return (
    <Link href={`/alumno/dia/${a.dayId}`} className={`active-workout-bar ${stale ? 'stale' : ''}`}>
      <span className="in">
        <span style={{ fontSize: '1.3rem' }}>{stale ? '⏰' : '⏱'}</span>
        <span className="grow">
          <b>{stale ? '¿Seguís entrenando?' : `Entrenando · ${a.dayTitle}`}</b>
          <span style={{ display: 'block', fontSize: '.85rem', opacity: .85 }}>{fmtDuration(ms)} · {a.done}/{a.total} series</span>
        </span>
        <span className="btn sm" style={{ background: 'var(--paper)', color: 'var(--graphite)', boxShadow: 'none' }}>{stale ? 'Finalizar' : 'Volver'}</span>
      </span>
    </Link>
  );
}
