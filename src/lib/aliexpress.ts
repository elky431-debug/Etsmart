import crypto from 'crypto';

const ALIEXPRESS_SYNC_ENDPOINT = 'https://api.aliexpress.com/sync';

export interface AliExpressOrderData {
  product_name: string | null;
  product_image: string | null;
  tracking_number: string | null;
  carrier: string | null;
}

interface AliExpressApiResult {
  data: unknown;
  rawText: string;
}

function aliexpressTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function buildAliExpressSign(params: Record<string, string>, appSecret: string): string {
  const keys = Object.keys(params).sort();
  const content = keys.map((k) => `${k}${params[k]}`).join('');
  return crypto.createHash('md5').update(`${appSecret}${content}${appSecret}`, 'utf8').digest('hex').toUpperCase();
}

async function callAliExpressApi(params: Record<string, string>): Promise<AliExpressApiResult> {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error('ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET manquants');
  }

  const baseParams: Record<string, string> = {
    app_key: appKey,
    format: 'json',
    sign_method: 'md5',
    timestamp: aliexpressTimestamp(),
    v: '2.0',
    ...params,
  };

  baseParams.sign = buildAliExpressSign(baseParams, appSecret);

  const body = new URLSearchParams(baseParams);
  const res = await fetch(ALIEXPRESS_SYNC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });

  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  if (!res.ok) {
    throw new Error(`AliExpress API HTTP ${res.status}: ${rawText.slice(0, 220)}`);
  }

  return { data, rawText };
}

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

    const entries = Object.entries(cur as Record<string, unknown>);
    for (const [k, v] of entries) {
      if (typeof v === 'string' && keysLower.includes(k.toLowerCase()) && v.trim()) {
        return v.trim();
      }
      if (typeof v === 'object' && v) stack.push(v);
    }
  }

  return null;
}

export async function fetchAliExpressOrder(
  orderId: string,
  accessToken?: string
): Promise<AliExpressOrderData> {
  const token = accessToken || process.env.ALIEXPRESS_ACCESS_TOKEN;
  if (!token) {
    throw new Error('ALIEXPRESS_ACCESS_TOKEN manquant');
  }
  if (!orderId || !orderId.trim()) {
    throw new Error('orderId AliExpress manquant');
  }

  const { data } = await callAliExpressApi({
    method: 'aliexpress.trade.order.get',
    access_token: token,
    order_id: orderId.trim(),
  });

  const product_name = deepFindFirstString(data, [
    'product_name',
    'productName',
    'item_title',
    'title',
    'subject',
  ]);
  const product_image = deepFindFirstString(data, [
    'product_image',
    'productImage',
    'product_img_url',
    'image',
    'image_url',
  ]);
  const tracking_number = deepFindFirstString(data, [
    'tracking_number',
    'trackingNo',
    'logistics_no',
    'trackingNumber',
    'tracking_code',
  ]);
  const carrier = deepFindFirstString(data, [
    'carrier',
    'carrier_name',
    'logistics_company',
    'service_name',
    'shipping_company',
  ]);

  return {
    product_name,
    product_image,
    tracking_number,
    carrier,
  };
}

export async function exchangeAliExpressCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
}> {
  if (!code || !code.trim()) {
    throw new Error('Code OAuth AliExpress manquant');
  }

  // Try via Open API sync first.
  try {
    const { data } = await callAliExpressApi({
      method: 'aliexpress.system.oauth.token',
      grant_type: 'authorization_code',
      code: code.trim(),
    });
    const access =
      deepFindFirstString(data, ['access_token', 'accessToken']) ||
      null;
    const refresh =
      deepFindFirstString(data, ['refresh_token', 'refreshToken']) ||
      null;
    if (access) {
      return { access_token: access, refresh_token: refresh };
    }
  } catch {
    // Fallback below.
  }

  // Fallback OAuth endpoint.
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error('ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET manquants');
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    client_id: appKey,
    client_secret: appSecret,
  });

  const res = await fetch('https://oauth.aliexpress.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form,
  });
  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }
  if (!res.ok) {
    throw new Error(`AliExpress OAuth HTTP ${res.status}: ${rawText.slice(0, 220)}`);
  }
  const access = deepFindFirstString(data, ['access_token', 'accessToken']);
  if (!access) {
    throw new Error(`AliExpress OAuth sans access_token: ${rawText.slice(0, 220)}`);
  }
  const refresh = deepFindFirstString(data, ['refresh_token', 'refreshToken']);
  return { access_token: access, refresh_token: refresh };
}
