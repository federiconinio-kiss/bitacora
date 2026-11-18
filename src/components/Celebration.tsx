'use client';
import { useEffect, useRef } from 'react';
import { IconTrophy } from './Icons';

function confetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  // Papelitos: tinta azul, marcador rojo, resaltador, post-its
  const colors = ['#1f3d7a', '#c0392b', '#fbe97a', '#ffd1dc', '#d6f5c8', '#cfe8ff', '#2f7a4b'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 15 - 4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let raf = 0, t = 0;
  const tick = () => {
    t++;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(t / 8 + p.r)));
      ctx.restore();
    });
    if (t < 260) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  tick();
  return () => cancelAnimationFrame(raf);
}

export default function Celebration({ title, lines, stamp = '¡Subís carga!', onClose, festive = true }: { title: string; lines: React.ReactNode[]; stamp?: string; onClose: () => void; festive?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!festive) return;
    const stop = ref.current ? confetti(ref.current) : () => {};
    navigator.vibrate?.([60, 40, 120]);
    return stop;
  }, [festive]);
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <canvas ref={ref} className="confetti" />
      <div className="card sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '30px 22px 24px 54px' }}>
        <span className="tape" />
        {festive && <div style={{ color: 'var(--amber)' }}><IconTrophy size={54} /></div>}
        <h2 className="h-hand" style={{ fontSize: '2.4rem' }}>{title}</h2>
        <div style={{ margin: '14px 0 18px' }}><span className={`stamp big ${festive ? 'green' : ''}`}>{stamp}</span></div>
        <div className="stack" style={{ gap: 6 }}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
        <button className="btn primary block" style={{ marginTop: 20 }} onClick={onClose}>¡Vamos!</button>
      </div>
    </div>
  );
}
