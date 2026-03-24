import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { fetchAliExpressOrder } from '@/lib/aliexpress';
import { registerOnParcelsapp } from '@/lib/parcelsapp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const providedSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Secret cron invalide.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, user_id, aliexpress_order_id')
      .eq('status', 'pending_tracking')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: 'POLL_FAILED', message: error.message },
        { status: 500 }
      );
    }

    const list = orders || [];
    const userIds = Array.from(new Set(list.map((o) => o.user_id)));
    const tokenByUserId = new Map<string, string | null>();

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, aliexpress_access_token')
        .in('id', userIds);
      for (const u of users || []) {
        tokenByUserId.set(u.id, u.aliexpress_access_token || null);
      }
    }

    let processed = 0;
    let updated = 0;
    let registered = 0;
    const errors: Array<{ order_id: string; error: string }> = [];

    for (const order of list) {
      processed += 1;
      try {
        const accessToken = tokenByUserId.get(order.user_id) || undefined;
        const details = await fetchAliExpressOrder(order.aliexpress_order_id, accessToken);
        if (details.tracking_number) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              tracking_number: details.tracking_number,
              carrier: details.carrier,
              product_name: details.product_name,
              product_image: details.product_image,
              status: 'registered',
              last_event: 'Numéro de suivi détecté via polling.',
              last_event_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);

          if (!updateError) {
            updated += 1;
            const reg = await registerOnParcelsapp(details.tracking_number, details.carrier);
            if (reg.success) registered += 1;
          } else {
            errors.push({ order_id: order.id, error: updateError.message });
          }
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'poll item error';
        errors.push({
          order_id: order.id,
          error: message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return NextResponse.json({
      success: true,
      processed,
      updated,
      registered,
      errors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: 'SERVER_ERROR', message },
      { status: 500 }
    );
  }
}
