'use client';
import Link from 'next/link';

export default function DietTabs({ tab, hasPlan }: { tab: 'diario' | 'plan'; hasPlan: boolean }) {
  return (
    <div className="chips" role="tablist">
      <Link role="tab" aria-selected={tab === 'diario'} className={`chip ${tab === 'diario' ? 'on' : ''}`} href="/alumno/dieta" style={{ textDecoration: 'none' }}>Diario de comidas</Link>
      {hasPlan ? (
        <Link role="tab" aria-selected={tab === 'plan'} className={`chip ${tab === 'plan' ? 'on' : ''}`} href="/alumno/dieta?ver=plan" style={{ textDecoration: 'none' }}>Mi plan</Link>
      ) : (
        <span className="chip" style={{ cursor: 'default', opacity: .6 }} title="Tu profe todavía no cargó un plan">Mi plan (sin cargar)</span>
      )}
    </div>
  );
}
