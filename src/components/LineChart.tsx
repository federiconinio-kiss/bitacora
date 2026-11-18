'use client';
import { useRef, useState } from 'react';

export type Point = { x: string; y: number; label?: string; detail?: string };

/** Gráfico de línea simple (una serie) con tooltip al tocar/pasar el mouse. */
export default function LineChart({ data, unit = '', height = 170, ariaLabel }: { data: Point[]; unit?: string; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  if (!data.length) return <p className="muted small">Sin datos todavía.</p>;

  const W = 560, H = height, padL = 40, padR = 16, padT = 24, padB = 26;
  const ys = data.map((d) => d.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min = Math.max(0, min - span * 0.15);
  max = max + span * 0.15;
  const x = (i: number) => (data.length === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (data.length - 1));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [min, (min + max) / 2, max];
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const every = Math.ceil(data.length / 6);
  const fmt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const last = data.length - 1;

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    data.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  const h = hover != null ? data[hover] : null;
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}
        onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        <g className="grid">{ticks.map((t, i) => <line key={i} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />)}</g>
        <g className="axis">
          {ticks.map((t, i) => <text key={i} x={padL - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text>)}
          {data.map((d, i) => (i % every === 0 || i === last) && (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{d.label ?? d.x}</text>
          ))}
        </g>
        {data.length > 1 && <path className="area" d={area} />}
        <path className="series" d={path} />
        {hover != null && <line className="xhair" x1={x(hover)} x2={x(hover)} y1={padT - 6} y2={H - padB} />}
        {data.map((d, i) => <circle key={i} className={`dot ${i === last ? 'last' : ''}`} cx={x(i)} cy={y(d.y)} r={hover === i ? 6 : 4.5} />)}
        <text className="label" x={x(last)} y={y(data[last].y) - 10} textAnchor={data.length > 1 ? 'end' : 'middle'}>
          {fmt(data[last].y)}{unit && ` ${unit}`}
        </text>
        <rect className="hit" x={0} y={0} width={W} height={H} />
      </svg>
      {h && hover != null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.y) / H) * 100}%` }}>
          <b>{fmt(h.y)} {unit}</b> · {h.label ?? h.x}{h.detail ? <><br />{h.detail}</> : null}
        </div>
      )}
    </div>
  );
}
