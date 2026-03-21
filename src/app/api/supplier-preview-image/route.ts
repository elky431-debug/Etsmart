import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { fetchAliExpressPreviewImage } from '@/lib/supplier-preview-image';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const imageUrl = await fetchAliExpressPreviewImage(url);

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl ?? null,
    });
  } catch (e) {
    console.error('[supplier-preview-image]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
