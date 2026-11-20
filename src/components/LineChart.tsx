'use client';
import { useEffect, useRef, useState } from 'react';

export type Point = { x: string; y: number; label?: string; detail?: string; note?: string };

const fmtN = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Ticks "redondos" para el eje Y (p. ej. 30, 35, 40). */
function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { ticks, lo, hi };
}

/**
 * Gráfico de línea de una serie. Se dibuja al ancho real del contenedor
 * (1 unidad = 1 px), así los textos de los ejes mantienen un tamaño legible en el celular.
 */
export default function LineChart({ data, unit = '', height = 200, ariaLabel }: { data: Point[]; unit?: string; height?: number; ariaLabel: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return <p className="muted small">Sin datos todavía.</p>;

  const H = height, padL = 46, padR = 18, padT = 30, padB = 30;
  const ys = data.map((d) => d.y);
  const { ticks, lo, hi } = niceTicks(Math.min(...ys), Math.max(...ys));
  const min = lo === hi ? lo - 1 : lo, max = lo === hi ? hi + 1 : hi;
  const x = (i: number) => (data.length === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (data.length - 1));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  // Cuántas etiquetas del eje X entran sin pisarse (~64 px cada una)
  const maxLabels = Math.max(2, Math.floor((W - padL - padR) / 64));
  const every = Math.ceil(data.length / maxLabels);
  const last = data.length - 1;

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0, bd = Infinity;
    data.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  const h = hover != null ? data[hover] : null;
  const lastLabel = `${fmtN(data[last].y)}${unit ? ` ${unit}` : ''}`;
  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}
        onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        <g className="grid">{ticks.map((t) => <line key={t} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />)}</g>
        <g className="axis">
          {ticks.map((t) => <text key={t} x={padL - 8} y={y(t) + 4} textAnchor="end">{fmtN(t)}</text>)}
          {data.map((d, i) => (i % every === 0 || i === last) && (i === last || last - i >= every) && (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 && data.length > 1 ? 'start' : i === last && data.length > 1 ? 'end' : 'middle'}>{d.label ?? d.x}</text>
          ))}
        </g>
        {data.length > 1 && <path className="area" d={area} />}
        <path className="series" d={path} />
        {hover != null && <line className="xhair" x1={x(hover)} x2={x(hover)} y1={padT - 8} y2={H - padB} />}
        {data.map((d, i) => <circle key={i} className={`dot ${i === last ? 'last' : ''}`} cx={x(i)} cy={y(d.y)} r={hover === i ? 6.5 : 5} />)}
        <text className="label" x={Math.min(x(last), W - padR)} y={y(data[last].y) - 12} textAnchor={data.length > 1 ? 'end' : 'middle'}>{lastLabel}</text>
        <rect className="hit" x={0} y={0} width={W} height={H} />
      </svg>
      {h && hover != null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hover), 90), W - 90), top: y(h.y) }}>
          <b>{fmtN(h.y)} {unit}</b> · {h.label ?? h.x}
          {h.detail ? <><br />{h.detail}</> : null}
          {h.note ? <><br />{h.note}</> : null}
        </div>
      )}
    </div>
  );
}
