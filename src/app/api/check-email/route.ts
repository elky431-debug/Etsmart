import { NextRequest, NextResponse } from 'next/server';
import disposableDomains from 'disposable-email-domains';

const BLOCKED_RESPONSE = NextResponse.json(
  { error: 'Email temporaire non autorisé' },
  { status: 400 }
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  // 1. Static check — instant, covers 100k+ known disposable domains
  if ((disposableDomains as string[]).includes(domain)) {
    return BLOCKED_RESPONSE;
  }

  // 2. Live API check — catches new/unknown domains (flownue.com, etc.)
  try {
    const res = await fetch(
      `https://disposable.debounce.io/?email=${encodeURIComponent(email)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.disposable === 'true') {
        return BLOCKED_RESPONSE;
      }
    }
  } catch {
    // If the external API is down, allow the email through (fail open)
    // to avoid blocking legit users during API outages
  }

  return NextResponse.json({ ok: true });
}
