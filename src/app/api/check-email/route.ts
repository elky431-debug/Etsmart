import { NextRequest, NextResponse } from 'next/server';
import disposableDomains from 'disposable-email-domains';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const domain = email.split('@')[1]?.toLowerCase().trim();

  if (!domain) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  if ((disposableDomains as string[]).includes(domain)) {
    return NextResponse.json(
      { error: 'Email temporaire non autorisé' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
