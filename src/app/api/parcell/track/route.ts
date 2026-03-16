import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const PARCELSAPP_TRACKING_URL = 'https://parcelsapp.com/api/v3/shipments/tracking';

/**
 * API ParcelsApp (parcelsapp.com) : suivi par numéro.
 * Flux en 2 étapes : POST pour créer la requête (uuid), puis GET avec polling jusqu'à done.
 *
 * Variable d'environnement :
 * - PARCELSAPP_API_KEY ou PARCELL_APP_TOKEN : clé API ParcelsApp
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token invalide ou expiré.' }, { status: 401 });
    }

    const apiKey = process.env.PARCELSAPP_API_KEY || process.env.PARCELL_APP_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'PARCELL_NOT_CONFIGURED',
          message: 'ParcelsApp n’est pas configuré. Ajoute PARCELSAPP_API_KEY (ou PARCELL_APP_TOKEN) dans .env.local',
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trackingNumber =
      typeof body.trackingNumber === 'string'
        ? body.trackingNumber.trim()
        : (body.tracking_number && String(body.tracking_number).trim());
    const destinationCountry =
      typeof body.destinationCountry === 'string' && body.destinationCountry.trim()
        ? body.destinationCountry.trim()
        : 'France';

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Numéro de suivi requis.' },
        { status: 400 }
      );
    }

    // Étape 1 : POST pour initier le suivi
    const postRes = await fetch(PARCELSAPP_TRACKING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        language: 'fr',
        shipments: [
          {
            trackingId: trackingNumber,
            destinationCountry,
          },
        ],
      }),
    });

    const postData = await postRes.json().catch(() => ({}));

    if (!postRes.ok) {
      const message =
        postData?.message || postData?.error_message || postData?.error || postRes.statusText;
      return NextResponse.json(
        { error: 'PARCELL_ERROR', message: message || 'Erreur ParcelsApp (étape 1).' },
        { status: postRes.status >= 400 ? postRes.status : 500 }
      );
    }

    // UUID peut être sous différentes clés selon la version de l'API
    const uuid =
      postData?.uuid ??
      postData?.id ??
      postData?.requestId ??
      postData?.trackingUuid ??
      (typeof postData?.data === 'object' && postData?.data !== null
        ? (postData.data as Record<string, unknown>)?.uuid ??
          (postData.data as Record<string, unknown>)?.id
        : null);

    // Si la réponse POST contient déjà des shipments exploitables, on les utilise directement
    const postShipments = Array.isArray(postData?.shipments) ? postData.shipments : [];
    const postDone = postData?.done === true;
    const hasUsablePostData =
      postDone && postShipments.length > 0 && (postShipments[0]?.carrier ?? postShipments[0]?.carrierName ?? postShipments[0]?.status);

    let lastData: Record<string, unknown> = postData;

    if (!uuid && !hasUsablePostData) {
      const apiError =
        (typeof postData?.error === 'string' && postData.error) ||
        (typeof postData?.message === 'string' && postData.message) ||
        (typeof postData?.error_message === 'string' && postData.error_message) ||
        (typeof postData?.error === 'object' && postData?.error !== null && (postData.error as Record<string, unknown>)?.message && String((postData.error as Record<string, unknown>).message));
      const hint = typeof postData === 'object' && postData !== null ? Object.keys(postData).join(', ') : 'réponse vide';
      const message = apiError
        ? `ParcelsApp: ${apiError}`
        : `Réponse ParcelsApp invalide (uuid manquant). Champs reçus: ${hint}. Vérifiez la clé API et le format.`;
      return NextResponse.json(
        { error: 'PARCELL_ERROR', message },
        { status: 502 }
      );
    }

    if (hasUsablePostData) {
      lastData = postData;
    } else if (uuid) {
      // Étape 2 : GET avec polling jusqu'à done (max ~20 s)
      const maxAttempts = 10;
      const delayMs = 2000;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1500 : delayMs));

        const getRes = await fetch(
          `${PARCELSAPP_TRACKING_URL}?uuid=${encodeURIComponent(String(uuid))}&apiKey=${encodeURIComponent(apiKey)}`,
          { method: 'GET', headers: { Accept: 'application/json' } }
        );
        const getData = await getRes.json().catch(() => ({}));
        lastData = getData as Record<string, unknown>;

        if (!getRes.ok) {
          const msg = (getData as Record<string, unknown>)?.message || (getData as Record<string, unknown>)?.error || getRes.statusText;
          return NextResponse.json(
            { error: 'PARCELL_ERROR', message: String(msg || 'Erreur ParcelsApp (étape 2).') },
            { status: getRes.status >= 400 ? getRes.status : 500 }
          );
        }

        if ((getData as Record<string, unknown>)?.done === true) {
          break;
        }
      }
    }

    // Extraire transporteur et statut depuis shipments (ParcelsApp peut renvoyer carrier en code numérique → préférer les noms)
    const shipments = Array.isArray(lastData?.shipments) ? lastData.shipments : [];
    const first = shipments[0] as Record<string, unknown> | undefined;
    const rawCarrier = first?.carrier;
    const companyAttr = Array.isArray(first?.attributes)
      ? first.attributes.find((a: any) => a?.l === 'company' || a?.n === 'Delivery Company')
      : null;
    const carrier =
      (typeof first?.carrier === 'object' && first?.carrier !== null && typeof (first.carrier as Record<string, unknown>)?.name === 'string'
        ? String((first.carrier as Record<string, unknown>).name)
        : null) ||
      (typeof first?.detectedCarrier === 'object' && first?.detectedCarrier !== null && typeof (first.detectedCarrier as Record<string, unknown>)?.name === 'string'
        ? String((first.detectedCarrier as Record<string, unknown>).name)
        : null) ||
      (typeof first?.deliveryCompany === 'string' && first.deliveryCompany.trim() && first.deliveryCompany) ||
      (typeof first?.carrierName === 'string' && first.carrierName.trim() && first.carrierName) ||
      (typeof first?.foundIn === 'string' && first.foundIn.trim() && first.foundIn) ||
      (Array.isArray(first?.carriers) && first.carriers[0] && String(first.carriers[0])) ||
      (Array.isArray(first?.services) && first.services[0] && typeof first.services[0]?.name === 'string' ? String(first.services[0].name) : null) ||
      (companyAttr && typeof companyAttr?.val === 'string' ? companyAttr.val : null) ||
      (typeof first?.courier === 'string' && first.courier.trim() && first.courier) ||
      (typeof first?.service === 'string' && first.service.trim() && first.service) ||
      (typeof rawCarrier === 'string' && rawCarrier.trim() ? rawCarrier : null) ||
      (typeof rawCarrier === 'number' && rawCarrier !== 0 ? String(rawCarrier) : null) ||
      '—';
    const rawStatus =
      (typeof first?.status === 'string' && first.status) ||
      (typeof first?.deliveryStatus === 'string' && first.deliveryStatus) ||
      (typeof first?.state === 'string' && first.state) ||
      (first?.events?.length ? 'En transit' : '—');
    const statusLabels: Record<string, string> = {
      delivered: 'Livré',
      in_transit: 'En transit',
      'in transit': 'En transit',
      out_for_delivery: 'En cours de livraison',
      picked_up: 'Pris en charge',
      exception: 'Exception',
      not_found: 'Non trouvé',
    };
    const status =
      typeof rawStatus === 'string' && statusLabels[rawStatus.toLowerCase()]
        ? statusLabels[rawStatus.toLowerCase()]
        : rawStatus;
    const stateEvents = Array.isArray(first?.states)
      ? first.states.map((s: any) => ({
          event: s?.status ?? '',
          date: s?.date ?? '',
          location: s?.location ?? '',
        }))
      : [];
    const events = Array.isArray(first?.events) ? first.events : stateEvents;
    const dateExpected = first?.estimatedDelivery ?? first?.deliveryDate ?? first?.dateExpected ?? null;

    return NextResponse.json({
      success: true,
      trackingNumber,
      carrier: typeof carrier === 'string' ? carrier : '—',
      status: typeof status === 'string' ? status : '—',
      events: events.slice(0, 30),
      dateExpected: dateExpected ?? null,
      origin: first?.origin ?? null,
      destination: first?.destination ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
