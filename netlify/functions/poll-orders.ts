import type { ScheduledHandler } from '@netlify/functions';

export const config = {
  schedule: '0 * * * *',
};

export const handler: ScheduledHandler = async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CRON_SECRET manquant' }),
    };
  }

  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3011';
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/orders/poll`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret,
      },
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      body: text || JSON.stringify({ ok: res.ok }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'poll-orders failed',
        message,
      }),
    };
  }
};
