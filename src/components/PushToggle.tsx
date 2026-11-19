'use client';
import { useEffect, useState } from 'react';
import { IconBell } from './Icons';

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

/** Activa o desactiva las notificaciones en este dispositivo. */
export default function PushToggle({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await registerSW();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await registerSW();
      if (!reg) throw new Error('Este navegador no permite notificaciones.');
      await navigator.serviceWorker.ready;
      const { publicKey, error } = await (await fetch('/api/push/key')).json();
      if (!publicKey) throw new Error(error ?? 'No se pudo activar.');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo guardar.');
      setState('on');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;
  if (compact && (state === 'on' || state === 'unsupported')) return null;

  return (
    <div className={compact ? 'notice' : 'stack'} style={compact ? { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } : { gap: 6 }}>
      <span className="row" style={{ gap: 8 }}><IconBell size={20} /><b>Notificaciones</b></span>
      {state === 'on' && (<><span className="small">Activadas en este dispositivo.</span><button className="btn ghost sm" disabled={busy} onClick={disable}>Desactivar</button></>)}
      {state === 'off' && (<><span className="small">Enterate al momento de lo importante.</span><button className="btn primary sm" disabled={busy} onClick={enable}>{busy ? <span className="spinner" /> : 'Activar'}</button></>)}
      {state === 'denied' && <span className="small">Están bloqueadas para este sitio. Habilitalas desde la configuración del navegador.</span>}
      {state === 'ios-install' && <span className="small">En iPhone primero agregá la app a la pantalla de inicio (Safari → Compartir → Agregar a inicio) y abrila desde ahí.</span>}
      {state === 'unsupported' && <span className="small">Este navegador no permite notificaciones.</span>}
      {err && <span className="small" style={{ color: 'var(--red)' }}>{err}</span>}
    </div>
  );
}
