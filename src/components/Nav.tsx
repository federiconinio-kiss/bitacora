'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { IconApple, IconBell, IconBook, IconChart, IconLogo, IconLogout, IconPlan, IconUser, IconUsers } from './Icons';

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number; exact?: boolean };

/** Contenido del link que se marca al instante mientras la sección carga. */
function TabInner({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={`tab-inner ${pending ? 'pending' : ''}`}>{children}{pending && <span className="tab-spinner" aria-hidden="true" />}</span>;
}

function useActive() {
  const path = usePathname();
  return (it: Item) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + '/'));
}

function Logout() {
  return (
    <form action="/salir" method="post">
      <button className="btn ghost sm" title="Salir" aria-label="Salir"><IconLogout /> <span className="hide-mobile">Salir</span></button>
    </form>
  );
}

export function StudentNav({ name }: { name: string }) {
  const isOn = useActive();
  const items: Item[] = [
    { href: '/alumno', label: 'Mi plan', icon: <IconPlan />, exact: true },
    { href: '/alumno/dieta', label: 'Dieta', icon: <IconApple /> },
    { href: '/alumno/historial', label: 'Historial', icon: <IconChart /> },
    { href: '/alumno/perfil', label: 'Perfil', icon: <IconUser /> },
  ];
  return (
    <>
      <header className="topbar">
        <div className="topbar-in" style={{ maxWidth: 760 }}>
          <Link href="/alumno" className="brand"><IconLogo /> Entrena con Fede</Link>
          <span className="grow" />
          <span className="type hide-mobile">{name}</span>
          <Logout />
        </div>
      </header>
      <nav className="tabbar" aria-label="Secciones">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={isOn(it) ? 'on' : ''}>
            <TabInner>{it.icon}{it.label}</TabInner>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function TrainerNav({ pending }: { pending: number }) {
  const isOn = useActive();
  const items: Item[] = [
    { href: '/profe', label: 'Avisos', icon: <IconBell />, badge: pending, exact: true },
    { href: '/profe/alumnos', label: 'Alumnos', icon: <IconUsers /> },
    { href: '/profe/ejercicios', label: 'Ejercicios', icon: <IconBook /> },
    { href: '/profe/alimentos', label: 'Alimentos', icon: <IconApple /> },
  ];
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/profe" className="brand"><IconLogo /> Entrena con Fede <span className="tag ink" style={{ fontSize: '.6rem' }}>profe</span></Link>
          <nav className="topnav" aria-label="Secciones">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className={isOn(it) ? 'on' : ''}>
                <TabInner>{it.label} {!!it.badge && <span className="badge">{it.badge}</span>}</TabInner>
              </Link>
            ))}
          </nav>
          <span className="grow" />
          <Logout />
        </div>
      </header>
      <nav className="tabbar trainer" aria-label="Secciones">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={isOn(it) ? 'on' : ''}>
            <TabInner>{it.icon}{it.label}{!!it.badge && <span className="badge">{it.badge}</span>}</TabInner>
          </Link>
        ))}
      </nav>
    </>
  );
}
