import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TRACKTACO_USA_URL = 'https://fthoqqsb4k.execute-api.us-east-1.amazonaws.com/prod/get-trackingnr';
const TRACKTACO_INTL_URL = 'https://fthoqqsb4k.execute-api.us-east-1.amazonaws.com/prod/get-trackingnr-intl';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Supabase non configuré.' }, { status: 401 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' }, { status: 401 });
    }

    const apiKey = process.env.TRACKTACO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TRACKTACO_NOT_CONFIGURED', message: 'Clé API Tracktaco non configurée.' },
        { status: 500 }
      );
    }

    // Vérifier le quota avant d'appeler Tracktaco (1 crédit par numéro généré)
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'Un abonnement actif est requis pour utiliser le suivi.' },
        { status: 403 }
      );
    }
    if (quotaInfo.remaining < 1) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: 'Crédits insuffisants. Il faut au moins 1 crédit pour générer un numéro de suivi.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type = 'usa', ...params } = body;

    const url = type === 'intl' ? TRACKTACO_INTL_URL : TRACKTACO_USA_URL;
    const now = Date.now();
    const defaultFrom = now;
    const defaultTo = now + 30 * 24 * 60 * 60 * 1000; // +30 jours
    const fromVal = typeof params.from === 'number' ? params.from : defaultFrom;
    const toVal = typeof params.to === 'number' ? params.to : defaultTo;

    const payload: Record<string, unknown> = {};

    if (type === 'intl') {
      if (params.country) payload.country = String(params.country).toUpperCase().slice(0, 2);
      if (params.state) payload.state = String(params.state).toUpperCase().slice(0, 2);
      if (params.city) payload.city = String(params.city).trim();
      if (params.originCity) payload.originCity = String(params.originCity).trim();
      if (params.originState) payload.originState = String(params.originState).toUpperCase().slice(0, 2);
      if (params.originCountry) payload.originCountry = String(params.originCountry).toUpperCase().slice(0, 2);
      payload.from = fromVal;
      payload.to = toVal;
      if (typeof params.checkOnWalmart === 'boolean') payload.checkOnWalmart = params.checkOnWalmart;
      if (typeof params.minShippedAt === 'number') payload.minShippedAt = params.minShippedAt;
      if (Array.isArray(params.deliveryState)) payload.deliveryState = params.deliveryState;
      if (['dhl', 'fedex', 'any'].includes(params.carrier)) payload.carrier = params.carrier;
    } else {
      if (params.state) payload.state = String(params.state).toUpperCase().slice(0, 2);
      if (params.city) payload.city = String(params.city).trim();
      payload.from = fromVal;
      payload.to = toVal;
      if (typeof params.checkOnWalmart === 'boolean') payload.checkOnWalmart = params.checkOnWalmart;
      if (typeof params.minShippedAt === 'number') payload.minShippedAt = params.minShippedAt;
      if (params.originCity) payload.originCity = String(params.originCity).trim();
      if (params.originState) payload.originState = String(params.originState).toUpperCase().slice(0, 2);
      if (['fedex', 'ups', 'any'].includes(params.carrier)) payload.carrier = params.carrier;
      if (Array.isArray(params.deliveryState)) payload.deliveryState = params.deliveryState;
      if (typeof params.allowPhoto === 'boolean') payload.allowPhoto = params.allowPhoto;
      if (typeof params.allowSignature === 'boolean') payload.allowSignature = params.allowSignature;
      if (typeof params.enableDoubleCheck === 'boolean') payload.enableDoubleCheck = params.enableDoubleCheck;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const status = res.status >= 400 ? res.status : 500;
      const message = status === 403
        ? 'Accès refusé par Tracktaco (vérifiez votre clé API sur app.tracktaco.com).'
        : (data.error || data.message || res.statusText);
      return NextResponse.json(
        { error: data.error || 'TRACKTACO_ERROR', errorCode: data.errorCode || (status === 403 ? 'FORBIDDEN' : undefined), message },
        { status }
      );
    }

    if (data.error || data.errorCode) {
      return NextResponse.json(
        {
          error: data.error || 'TRACKTACO_ERROR',
          errorCode: data.errorCode,
          message: data.error === 'No credits' ? 'Plus de crédits Tracktaco.' : data.error,
        },
        { status: 400 }
      );
    }

    // Déduire 1 crédit après un appel Tracktaco réussi
    try {
      const result = await incrementAnalysisCount(user.id, 1.0);
      if (!result.success) {
        console.error('[TRACKTACO] Échec de la déduction de crédit :', result.error);
      } else {
        console.log(`[TRACKTACO] ✅ 1 crédit déduit. Utilisés: ${result.used}/${result.quota}`);
      }
    } catch (err: any) {
      console.error('[TRACKTACO] Erreur lors de la déduction de crédit :', err?.message || err);
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
