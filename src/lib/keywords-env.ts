/**
 * Résolution des clés pour l’analyse keywords.
 *
 * Etsy — header `x-api-key` : **keystring:shared_secret** (séparés par `:`).
 * Recommandé : une seule ligne
 *   ETSY_API_KEY=ma_keystring:mon_shared_secret
 * Variante : uniquement la keystring dans ETSY_API_KEY + secret dans ETSY_API_SECRET (ou ETSY_SHARED_SECRET, ETSY_KEYWORD_API_SECRET).
 */

function isPlaceholderSecret(value: string | undefined): boolean {
  const s = value?.trim() ?? '';
  if (!s) return true;
  return /^your_|^changeme|^replace|^placeholder|^xxx/i.test(s);
}

/** true → exécuter le job via after() (même processus, garde .env.local en dev). */
export function shouldRunKeywordJobInProcess(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const internal = process.env.KEYWORDS_INTERNAL_SECRET?.trim();
  const cron = process.env.CRON_SECRET?.trim();
  const secret = internal || cron;
  return isPlaceholderSecret(secret);
}

export function resolveOpenAiApiKey(): string | null {
  const k = process.env.OPENAI_API_KEY?.trim();
  return k || null;
}

/** Shared secret Etsy (colonne « Shared secret » sur developers.etsy.com → Your apps). */
function resolveEtsySharedSecret(): string | null {
  return (
    process.env.ETSY_API_SECRET?.trim() ||
    process.env.ETSY_KEYWORD_API_SECRET?.trim() ||
    process.env.ETSY_SHARED_SECRET?.trim() ||
    null
  );
}

/** Valeur complète du header x-api-key (keystring:shared_secret). */
export function resolveEtsyXApiKey(): string | null {
  const raw = process.env.ETSY_API_KEY?.trim();
  const secret = resolveEtsySharedSecret();
  if (raw) {
    if (raw.includes(':')) {
      return raw;
    }
    if (secret) {
      return `${raw}:${secret}`;
    }
    return raw;
  }
  const k = process.env.ETSY_KEYWORD_API_KEY?.trim();
  const s = secret || null;
  if (k && s) return `${k}:${s}`;
  if (k) return k;
  return null;
}

/**
 * Clé pour l’analyse keywords / Open API publique uniquement.
 *
 * Si `ETSY_KEYWORD_API_KEY` est défini, on associe **en priorité** `ETSY_KEYWORD_API_SECRET`
 * (puis `ETSY_API_SECRET`), pour éviter qu’un `ETSY_API_KEY` défini ailleurs (shell, Netlify,
 * autre fichier .env) ne prenne le pas et ne soit couplé au mauvais secret → 403 Etsy.
 *
 * Sinon, repli sur `resolveEtsyXApiKey()` (ETSY_API_KEY seul ou key:secret).
 */
export function resolveEtsyKeywordOpenApiKey(): string | null {
  const kw = process.env.ETSY_KEYWORD_API_KEY?.trim();
  if (kw) {
    if (kw.includes(':')) return kw;
    const s =
      process.env.ETSY_KEYWORD_API_SECRET?.trim() ||
      process.env.ETSY_API_SECRET?.trim() ||
      process.env.ETSY_SHARED_SECRET?.trim() ||
      null;
    if (s) return `${kw}:${s}`;
    return null;
  }
  return resolveEtsyXApiKey();
}

/**
 * Clé Etsy pour l’analyse keywords : **keystring seule** dans le header `x-api-key` (pas OAuth).
 *
 * Pris en charge :
 * - `ETSY_API_KEY=keystring` ou `ETSY_API_KEY=keystring:shared_secret` (on garde la partie avant `:`)
 * - **Key et secret sur deux variables** (comme le reste du projet) : `ETSY_KEYWORD_API_KEY` + `ETSY_API_SECRET`
 *   si `ETSY_API_KEY` n’est pas défini.
 */
export function resolveEtsyKeywordKeystring(): string | null {
  const raw = process.env.ETSY_API_KEY?.trim();
  const alt = process.env.ETSY_KEYWORD_API_KEY?.trim();
  const combined = raw || alt;
  if (!combined) return null;
  const i = combined.indexOf(':');
  return (i === -1 ? combined : combined.slice(0, i)).trim() || null;
}

/** Jeton OAuth serveur (fallback) ; sinon on lit etsy_connections pour l’utilisateur. */
export function resolveEtsyAccessTokenFromEnv(): string | null {
  const t =
    process.env.ETSY_ACCESS_TOKEN?.trim() ||
    process.env.ETSY_OAUTH_ACCESS_TOKEN?.trim();
  return t || null;
}

/** Pour OAuth : client_id = keystring seulement (jamais « key:secret »). */
export function resolveEtsyOAuthClientId(): string | null {
  const raw = process.env.ETSY_API_KEY?.trim();
  if (raw) {
    const i = raw.indexOf(':');
    return (i === -1 ? raw : raw.slice(0, i)).trim() || null;
  }
  return process.env.ETSY_KEYWORD_API_KEY?.trim() || null;
}

/** Shared secret pour l’échange du code OAuth (même valeur que côté x-api-key après le « : »). */
export function resolveEtsyOAuthClientSecret(): string | null {
  const fromEnv = resolveEtsySharedSecret();
  if (fromEnv) return fromEnv;
  const raw = process.env.ETSY_API_KEY?.trim();
  if (raw?.includes(':')) {
    return raw.slice(raw.indexOf(':') + 1).trim() || null;
  }
  return null;
}
