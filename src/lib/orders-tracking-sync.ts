import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAliExpressOrder } from '@/lib/aliexpress';
import { registerOnParcelsapp } from '@/lib/parcelsapp';

export async function tryUpdateOrderFromAliExpress(
  supabase: SupabaseClient,
  order: { id: string; aliexpress_order_id: string },
  accessToken: string | undefined
): Promise<{ updated: boolean; parcelsRegistered?: boolean; error?: string }> {
  try {
    const details = await fetchAliExpressOrder(order.aliexpress_order_id, accessToken);
    if (!details.tracking_number) {
      return { updated: false };
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: details.tracking_number,
        carrier: details.carrier,
        product_name: details.product_name,
        product_image: details.product_image,
        status: 'registered',
        last_event: 'Numéro de suivi détecté via synchronisation.',
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      return { updated: false, error: updateError.message };
    }

    const reg = await registerOnParcelsapp(details.tracking_number, details.carrier);
    return { updated: true, parcelsRegistered: reg.success };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { updated: false, error: message };
  }
}
