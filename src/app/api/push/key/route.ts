import { NextResponse } from 'next/server';
import { rememberSiteUrl, vapidKeys } from '@/lib/push';

export async function GET(request: Request) {
  try {
    await rememberSiteUrl(request);
    const { publicKey } = await vapidKeys();
    return NextResponse.json({ publicKey });
  } catch (e) {
    console.error('push key', e);
    return NextResponse.json({ error: 'Las notificaciones no están disponibles.' }, { status: 500 });
  }
}
