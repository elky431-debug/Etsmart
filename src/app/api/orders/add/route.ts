import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { fetchAliExpressOrder } from '@/lib/aliexpress';
import { registerOnParcelsapp } from '@/lib/parcelsapp';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const aliexpressOrderId = String(body?.aliexpress_order_id || '').trim();
    if (!aliexpressOrderId || aliexpressOrderId.length < 4) {
      return NextResponse.json(
        {
          error: 'INVALID_ORDER_ID',
          message: 'aliexpress_order_id invalide.',
        },
        { status: 400 }
      );
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('aliexpress_access_token')
      .eq('id', user.id)
      .maybeSingle();

    const orderData = await fetchAliExpressOrder(
      aliexpressOrderId,
      userRow?.aliexpress_access_token || undefined
    );
    const status = orderData.tracking_number ? 'registered' : 'pending_tracking';

    const payload = {
      user_id: user.id,
      aliexpress_order_id: aliexpressOrderId,
      product_name: orderData.product_name,
      product_image: orderData.product_image,
      tracking_number: orderData.tracking_number,
      carrier: orderData.carrier,
      status,
      last_event: orderData.tracking_number
        ? 'Commande enregistrée, suivi détecté.'
        : 'Commande importée, en attente du numéro de suivi.',
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdOrder, error: insertError } = await supabase
      .from('orders')
      .upsert(payload, { onConflict: 'user_id,aliexpress_order_id' })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'ORDER_INSERT_FAILED', message: insertError.message },
        { status: 500 }
      );
    }

    let parcelsRegistration: { success: boolean; data?: unknown; error?: string } | null = null;
    if (orderData.tracking_number) {
      parcelsRegistration = await registerOnParcelsapp(
        orderData.tracking_number,
        orderData.carrier
      );
    }

    return NextResponse.json({
      success: true,
      order: createdOrder,
      parcelsRegistration,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: 'ORDER_ADD_FAILED', message },
      { status: 500 }
    );
  }
}
