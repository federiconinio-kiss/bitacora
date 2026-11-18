export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Fecha local en formato YYYY-MM-DD (sin corrimiento por zona horaria). */
export function todayISO(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo */
export function isoWeekday(dateISO: string) {
  const d = new Date(dateISO + 'T12:00:00');
  return ((d.getDay() + 6) % 7) + 1;
}

/** Lunes de la semana de la fecha dada (YYYY-MM-DD). */
export function weekStart(dateISO: string) {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() - (isoWeekday(dateISO) - 1));
  return todayISO(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

export function fmtDate(dateISO: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(dateISO + 'T12:00:00').toLocaleDateString('es-AR', opts);
}

export function fmtKg(n: number | null | undefined) {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;
}

export function num(v: FormDataEntryValue | string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Devuelve el id de YouTube si la URL es un video, si no null. */
export function youtubeId(url: string | null | undefined) {
  if (!url) return null;
  const m =
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/);
  return m ? m[1] : null;
}

export function youtubeSearchUrl(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' técnica correcta')}`;
}

export function initials(name: string, fallback = '?') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
