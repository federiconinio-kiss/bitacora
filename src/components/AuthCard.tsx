import { IconLogo } from './Icons';

export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="shell" style={{ maxWidth: 460, paddingTop: 'max(6vh, 24px)' }}>
      <div className="row" style={{ justifyContent: 'center', marginBottom: 26 }}>
        <span className="brand" style={{ fontSize: 'clamp(2rem, 9vw, 2.6rem)' }}><IconLogo size={42} /> Entrena con Fede</span>
      </div>
      <div className="sheet tilt-l">
        <span className="tape" />
        <span className="punch" style={{ top: 60 }} />
        <span className="punch" style={{ bottom: 60 }} />
        <h1 className="h-hand" style={{ marginBottom: 2 }}>{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: 4 }}>{subtitle}</p>}
        <div style={{ marginTop: 18 }}>{children}</div>
      </div>
    </main>
  );
}
