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
    // Accept content as string only — attachments are stripped before sending
    const content = (m as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    const trimmed = content.trim().slice(0, 12000);
    out.push({ role, content: trimmed });
  }
  return out.slice(-24);
}

function getModeSystemAddition(mode: string): string {
  switch (mode) {
    case 'client':
      return '\n\nMODE ACTIF: Réponse client. Tu aides à rédiger des réponses professionnelles et empathiques à des clients Etsy (litiges, avis négatifs, questions). Propose directement un texte de réponse réutilisable.';
    case 'product':
      return '\n\nMODE ACTIF: Recherche produit. Tu aides à trouver des niches et produits à potentiel sur Etsy. Sois concret : donne des idées précises avec volume estimé, concurrence et angle de différenciation.';
    case 'listing':
      return '\n\nMODE ACTIF: Optimisation listing. Tu aides à améliorer titres, tags et descriptions Etsy pour le SEO. Propose directement le texte optimisé.';
    case 'pricing':
      return '\n\nMODE ACTIF: Pricing & marges. Tu aides à calculer le bon prix de vente, les marges et la rentabilité. Sois précis avec des chiffres.';
    case 'branding':
      return "\n\nMODE ACTIF: Branding & boutique. Tu aides à améliorer l'image de marque, la cohérence visuelle et la stratégie de boutique Etsy.";
    default:
      return ''; // general mode
  }
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

    let body: { messages?: unknown; mode?: string; attachment?: { name: string; dataUrl: string; type: string } | null };
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

    const mode = typeof body.mode === 'string' ? body.mode : 'general';
    const attachment = body.attachment ?? null;
    const isImageAttachment = attachment !== null && attachment.type.startsWith('image/');

    // Build the system prompt with optional mode addition
    const systemPrompt = ETSMART_COACH_SYSTEM_PROMPT + getModeSystemAddition(mode);

    // Build messages array for OpenAI
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      // All history except the last user message
      ...history.slice(0, -1).map((m): OpenAI.Chat.ChatCompletionMessageParam => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Handle the last user message — add vision content if image attachment present
    if (isImageAttachment && attachment) {
      const userText = last.content.trim() || "Analyse cette image et donne-moi des conseils pertinents pour mon activité Etsy.";
      const visionContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: attachment.dataUrl, detail: 'high' } },
      ];
      apiMessages.push({ role: 'user', content: visionContent });
    } else {
      apiMessages.push({ role: 'user', content: last.content });
    }

    const completion = await openai.chat.completions.create({
      model: isImageAttachment ? 'gpt-4o' : 'gpt-4o-mini',
      messages: apiMessages,
      max_tokens: isImageAttachment ? 1000 : 700,
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
