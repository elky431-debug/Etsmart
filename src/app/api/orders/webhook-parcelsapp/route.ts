import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function deepFindFirstString(input: unknown, keys: string[]): string | null {
  if (!input) return null;
  const keysLower = keys.map((k) => k.toLowerCase());
  const stack: unknown[] = [input];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) continue;
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }
    if (typeof cur !== 'object') continue;
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
      if (typeof v === 'string' && keysLower.includes(k.toLowerCase()) && v.trim()) {
        return v.trim();
      }
      if (typeof v === 'object' && v) stack.push(v);
    }
  }
  return null;
}

function mapTrackingStatus(raw: string | null): 'pending_tracking' | 'in_transit' | 'delivered' | 'exception' | 'registered' {
  const text = (raw || '').toLowerCase();
  if (!text) return 'registered';
  if (text.includes('deliver')) return 'delivered';
  if (text.includes('exception') || text.includes('failed') || text.includes('return') || text.includes('undeliver')) {
    return 'exception';
  }
  if (text.includes('transit') || text.includes('shipping') || text.includes('shipped') || text.includes('moving')) {
    return 'in_transit';
  }
  if (text.includes('pending') || text.includes('not found') || text.includes('label')) {
    return 'pending_tracking';
  }
  return 'registered';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const trackingNumber = deepFindFirstString(body, [
      'tracking_number',
      'trackingNumber',
      'tracking_no',
      'number',
      'parcel_number',
    ]);
    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'INVALID_WEBHOOK', message: 'tracking_number introuvable.' },
        { status: 400 }
      );
    }

    const rawStatus = deepFindFirstString(body, ['status', 'tracking_status', 'state', 'parcel_status']);
    const status = mapTrackingStatus(rawStatus);
    const lastEvent = deepFindFirstString(body, ['last_event', 'event', 'message', 'description']) || rawStatus || 'Mise à jour tracking';
    const lastEventAtRaw = deepFindFirstString(body, ['event_time', 'eventTime', 'updated_at', 'timestamp', 'date']);
    const parsedDate = lastEventAtRaw ? new Date(lastEventAtRaw) : new Date();
    const lastEventAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    const supabase = createSupabaseAdminClient();
    const { data: updatedOrders, error } = await supabase
      .from('orders')
      .update({
        status,
        last_event: lastEvent,
        last_event_at: lastEventAt,
        updated_at: new Date().toISOString(),
      })
      .eq('tracking_number', trackingNumber)
      .select('*');

    if (error) {
      return NextResponse.json(
        { error: 'UPDATE_FAILED', message: error.message },
        { status: 500 }
      );
    }

    const rows = updatedOrders || [];
    for (const order of rows) {
      const channel = supabase.channel('orders');
      await channel.send({
        type: 'broadcast',
        event: 'order_update',
        payload: {
          user_id: order.user_id,
          order,
        },
      });
      await supabase.removeChannel(channel);
    }

    return NextResponse.json({
      success: true,
      updated: rows.length,
      tracking_number: trackingNumber,
      status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: 'WEBHOOK_FAILED', message },
      { status: 500 }
    );
  }
}
