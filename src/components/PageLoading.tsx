/** Pantalla de carga instantánea mientras el servidor prepara la sección. */
export default function PageLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="stack-lg" aria-busy="true" aria-live="polite">
      <div className="skeleton" style={{ width: '45%', height: 34 }} />
      <div className="sheet skel-sheet">
        <div className="skeleton" style={{ width: '60%' }} />
        <div className="skeleton" style={{ width: '85%' }} />
        <div className="skeleton" style={{ width: '70%' }} />
      </div>
      <div className="sheet skel-sheet">
        <div className="skeleton" style={{ width: '50%' }} />
        <div className="skeleton" style={{ width: '80%' }} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
