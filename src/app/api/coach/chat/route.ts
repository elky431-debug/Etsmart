import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserQuotaInfo } from '@/lib/subscription-quota';
import { ETSMART_COACH_SYSTEM_PROMPT } from '@/lib/etsmart-coach-prompt';

export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    const trimmed = content.trim().slice(0, 12000);
    out.push({ role, content: trimmed });
  }
  return out.slice(-24);
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'CONFIG', message: 'OPENAI_API_KEY non configurée.' },
        { status: 500 },
      );
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session invalide.' }, { status: 401 });
    }

    const quota = await getUserQuotaInfo(user.id);
    if (quota.status !== 'active') {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_REQUIRED', message: 'Un abonnement actif est requis pour utiliser le Coach.' },
        { status: 403 },
      );
    }

    let body: { messages?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Corps JSON invalide.' }, { status: 400 });
    }

    const history = sanitizeMessages(body.messages);
    if (history.length === 0) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Envoie au moins un message.' }, { status: 400 });
    }

    const last = history[history.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Le dernier message doit être le tien.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: ETSMART_COACH_SYSTEM_PROMPT }, ...history],
      // Réponses courtes côté produit (Coach) — évite les pavés type tutoriel markdown
      max_tokens: 700,
      temperature: 0.55,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: 'EMPTY', message: 'Réponse vide du modèle.' }, { status: 502 });
    }

    return NextResponse.json({ message: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[coach/chat]', msg);
    return NextResponse.json({ error: 'SERVER_ERROR', message: msg }, { status: 500 });
  }
}
