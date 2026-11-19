import { NextResponse } from 'next/server';
import { vapidKeys } from '@/lib/push';

export async function GET() {
  try {
    const { publicKey } = await vapidKeys();
    return NextResponse.json({ publicKey });
  } catch (e) {
    console.error('push key', e);
    return NextResponse.json({ error: 'Las notificaciones no están disponibles.' }, { status: 500 });
  }
}
