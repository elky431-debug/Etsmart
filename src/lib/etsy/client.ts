/**
 * Client Etsy API v3
 * Documentation: https://developers.etsy.com/documentation/
 */

const ETSY_API_BASE = 'https://api.etsy.com/v3';

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  user_id: number;
  creation_tsz: number;
  title: string;
  currency_code: string;
  is_vacation: boolean;
  announcement: string | null;
  vacation_message: string | null;
  sale_message: string | null;
  digital_sale_message: string | null;
  last_updated_tsz: number;
  listing_active_count: number;
  digital_listing_count: number;
  login_name: string;
  accepts_custom_requests: boolean;
  policy_welcome: string | null;
  policy_payment: string | null;
  policy_shipping: string | null;
  policy_refunds: string | null;
  policy_additional: string | null;
  policy_seller_info: string | null;
  policy_updated_tsz: number;
  policy_has_private_receipt_info: boolean;
  has_unstructured_policies: boolean;
  policy_privacy: string | null;
  vacation_autoreply: string | null;
  url: string;
  image_url_760x100: string | null;
  num_favorers: number;
  languages: string[];
  icon_url_fullxfull: string | null;
  is_using_structured_policies: boolean;
  has_onboarded_structured_policies: boolean;
  include_disclaimer: boolean;
  is_direct_checkout_onboarded: boolean;
  is_etsy_payments_onboarded: boolean;
  is_opted_in_to_buyer_promise: boolean;
  is_shop_us_based: boolean;
  transaction_sold_count: number;
  shipping_from_country_iso: string | null;
  shop_location_country_iso: string | null;
  review_count: number;
  review_average: number | null;
}

export interface EtsyListing {
  listing_id: number;
  state: string;
  user_id: number;
  category_id: number | null;
  title: string;
  description: string;
  creation_tsz: number;
  ending_tsz: number;
  original_creation_tsz: number;
  last_modified_tsz: number;
  price: string;
  currency_code: string;
  quantity: number;
  sku: string[];
  tags: string[];
  materials: string[];
  shop_section_id: number | null;
  featured_rank: number | null;
  url: string;
  views: number;
  num_favorers: number;
  shipping_profile_id: number | null;
  processing_min: number | null;
  processing_max: number | null;
  who_made: string;
  when_made: string;
  is_supply: boolean;
  item_weight: number | null;
  item_length: number | null;
  item_width: number | null;
  item_height: number | null;
  item_weight_unit: string | null;
  item_dimensions_unit: string | null;
  is_personalizable: boolean;
  personalization_is_required: boolean;
  personalization_instructions: string | null;
  personalization_char_count_max: number | null;
  is_customizable: boolean;
  should_auto_renew: boolean;
  language: string;
  has_variations: boolean;
  taxonomy_id: number | null;
  taxonomy_path: string[];
  used_manufacturer: boolean;
  is_vintage: boolean;
}

export interface EtsyListingImage {
  listing_image_id: number;
  hex_code: string | null;
  red: number | null;
  green: number | null;
  blue: number | null;
  hue: number | null;
  saturation: number | null;
  brightness: number | null;
  is_black_and_white: boolean;
  creation_tsz: number;
  listing_id: number;
  rank: number;
  url_75x75: string;
  url_170x135: string;
  url_570xN: string;
  url_fullxfull: string;
  full_height: number | null;
  full_width: number | null;
}

/**
 * Récupère les informations d'un shop Etsy
 */
export async function getEtsyShop(accessToken: string, shopId: number): Promise<EtsyShop> {
  const response = await fetch(`${ETSY_API_BASE}/application/shops/${shopId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': process.env.ETSY_API_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Etsy API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Récupère les listings d'un shop Etsy (avec pagination)
 */
export async function getEtsyShopListings(
  accessToken: string,
  shopId: number,
  limit: number = 100,
  offset: number = 0
): Promise<{ results: EtsyListing[]; count: number }> {
  const response = await fetch(
    `${ETSY_API_BASE}/application/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': process.env.ETSY_API_KEY || '',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Etsy API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    count: data.count || 0,
  };
}

/**
 * Récupère tous les listings d'un shop (gère la pagination automatiquement)
 */
export async function getAllEtsyShopListings(
  accessToken: string,
  shopId: number
): Promise<EtsyListing[]> {
  const allListings: EtsyListing[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const { results, count } = await getEtsyShopListings(accessToken, shopId, limit, offset);
    allListings.push(...results);
    
    if (results.length < limit || allListings.length >= count) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allListings;
}

/**
 * Récupère un listing spécifique avec ses détails
 */
export async function getEtsyListing(
  accessToken: string,
  listingId: number
): Promise<EtsyListing> {
  const response = await fetch(`${ETSY_API_BASE}/application/listings/${listingId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': process.env.ETSY_API_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Etsy API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Récupère les images d'un listing
 */
export async function getEtsyListingImages(
  accessToken: string,
  listingId: number
): Promise<EtsyListingImage[]> {
  const response = await fetch(`${ETSY_API_BASE}/application/listings/${listingId}/images`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': process.env.ETSY_API_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Etsy API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Échange un code OAuth contre un access_token
 */
export async function exchangeEtsyOAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const clientId = process.env.ETSY_API_KEY;
  const clientSecret = process.env.ETSY_API_SECRET;
  const redirectUri = process.env.ETSY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Etsy OAuth credentials not configured');
  }

  const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code: code,
      code_verifier: '', // Pour PKCE, à implémenter si nécessaire
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Etsy OAuth error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

