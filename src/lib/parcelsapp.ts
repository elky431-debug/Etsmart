const PARCELSAPP_ENDPOINT = 'https://parcelsapp.com/api/v3/parcels/tracking';
const PARCELSAPP_WEBHOOK_URL = 'https://etsmart.app/api/orders/webhook-parcelsapp';

export async function registerOnParcelsapp(
  trackingNumber: string,
  carrier?: string | null
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const apiKey = process.env.PARCELSAPP_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'PARCELSAPP_API_KEY manquante' };
  }
  if (!trackingNumber || !trackingNumber.trim()) {
    return { success: false, error: 'trackingNumber manquant' };
  }

  const payload = {
    shipments: [
      {
        trackingNumber: trackingNumber.trim(),
        ...(carrier && carrier.trim() ? { carrier: carrier.trim() } : {}),
      },
    ],
    webhookUrl: PARCELSAPP_WEBHOOK_URL,
  };

  try {
    const res = await fetch(PARCELSAPP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return {
        success: false,
        error: `Parcelsapp HTTP ${res.status}: ${text.slice(0, 220)}`,
      };
    }

    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Parcelsapp request failed';
    return { success: false, error: message };
  }
}
