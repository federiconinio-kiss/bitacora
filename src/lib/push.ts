import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase/admin';

type Keys = { publicKey: string; privateKey: string };
let cached: Keys | null = null;

/** Claves VAPID: se generan la primera vez y quedan en app_config (sólo accesible con service role). */
export async function vapidKeys(): Promise<Keys> {
  if (cached) return cached;
  const admin = supabaseAdmin();
  const { data } = await admin.from('app_config').select('key,value').in('key', ['vapid_public', 'vapid_private']);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  let pub = get('vapid_public');
  let priv = get('vapid_private');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    // ignoreDuplicates: si otro pedido las creó al mismo tiempo, nos quedamos con esas.
    await admin.from('app_config').upsert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }], { onConflict: 'key', ignoreDuplicates: true });
    const { data: again } = await admin.from('app_config').select('key,value').in('key', ['vapid_public', 'vapid_private']);
    pub = again?.find((r) => r.key === 'vapid_public')?.value;
    priv = again?.find((r) => r.key === 'vapid_private')?.value;
  }
  cached = { publicKey: pub!, privateKey: priv! };
  return cached;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Identificación del remitente para los servicios de push: tiene que ser una URL https. */
function siteUrl() {
  const url = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  return url.startsWith('https://') ? url : 'https://entrena-con-fede.vercel.app';
}

/** Envía la notificación a todos los dispositivos del usuario; borra las suscripciones vencidas. */
export async function sendPush(userId: string, msg: PushMessage) {
  const admin = supabaseAdmin();
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
  if (!subs?.length) return { sent: 0 };
  const keys = await vapidKeys();
  webpush.setVapidDetails(siteUrl(), keys.publicKey, keys.privateKey);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push', status, (e as Error).message);
    }
  }));
  return { sent };
}
