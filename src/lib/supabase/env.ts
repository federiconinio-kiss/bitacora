/**
 * URL base del proyecto de Supabase, sin rutas ni barra final.
 * Acepta también la URL que muestra la pantalla "Data API" (…/rest/v1/).
 */
export function supabaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

export function supabaseKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
}
