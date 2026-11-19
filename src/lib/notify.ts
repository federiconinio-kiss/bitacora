'use client';
/** Avisa al servidor de un evento para que mande la notificación. Nunca bloquea ni falla en la UI. */
export function notify(event: 'progression_requested' | 'progression_resolved' | 'routine_published' | 'diet_published' | 'checkin', id: string) {
  fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, id }), keepalive: true }).catch(() => {});
}
