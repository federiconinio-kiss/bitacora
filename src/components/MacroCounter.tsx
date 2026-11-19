import type { Macros } from '@/lib/nutrition';

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
  { key: 'fat', label: 'Grasas', unit: 'g' },
];

/** Estado de una fila: dentro de ±5 % (o ±5 g) del objetivo está "en objetivo". */
export function rowState(value: number, target: number) {
  if (!target) return 'none';
  const tol = Math.max(target * 0.05, 5);
  if (value > target + tol) return 'over';
  if (value >= target - tol) return 'ok';
  return 'under';
}

export default function MacroCounter({ total, target, compact, title }: { total: Macros; target: Macros; compact?: boolean; title?: string }) {
  return (
    <div className={`macro-counter ${compact ? 'compact' : ''}`} role="group" aria-label={title ?? 'Calorías y macros del día'}>
      {title && <span className="type">{title}</span>}
      <div className="macro-rows">
        {ROWS.map((r) => {
          const v = Math.round(total[r.key]);
          const t = Math.round(target[r.key]);
          const st = rowState(v, t);
          const pct = t ? Math.min(100, (v / t) * 100) : 0;
          return (
            <div key={r.key} className={`macro-row ${st}`}>
              <div className="macro-head">
                <span className="macro-label">{r.label}</span>
                <span className="macro-val"><b>{v.toLocaleString('es-AR')}</b>{t ? <> / {t.toLocaleString('es-AR')}</> : null} {r.unit}</span>
              </div>
              <div className="macro-track" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              <span className="macro-state">
                {st === 'ok' ? '✓ en objetivo' : st === 'over' ? `+${(v - t).toLocaleString('es-AR')} de más` : st === 'under' ? `faltan ${(t - v).toLocaleString('es-AR')}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
