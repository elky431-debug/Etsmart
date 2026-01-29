import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ENDPOINT - Vérifier si OpenAI API fonctionne
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  const testResult = {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : 'N/A',
    timestamp: new Date().toISOString(),
  };
  
  // Test simple de l'API OpenAI
  if (apiKey) {
    try {
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(10000), // 10 secondes max
      });
      
      if (testResponse.ok) {
        const models = await testResponse.json();
        return NextResponse.json({
          ...testResult,
          openaiStatus: 'OK',
          canAccessOpenAI: true,
          availableModels: models.data?.slice(0, 5).map((m: any) => m.id) || [],
          hasGpt4o: models.data?.some((m: any) => m.id.includes('gpt-4o')) || false,
        });
      } else {
        const errorData = await testResponse.json().catch(() => ({}));
        return NextResponse.json({
          ...testResult,
          openaiStatus: 'ERROR',
          canAccessOpenAI: false,
          errorCode: testResponse.status,
          errorMessage: errorData.error?.message || testResponse.statusText,
        }, { status: 500 });
      }
    } catch (error: any) {
      return NextResponse.json({
        ...testResult,
        openaiStatus: 'ERROR',
        canAccessOpenAI: false,
        errorType: error.name,
        errorMessage: error.message,
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({
    ...testResult,
    openaiStatus: 'NO_API_KEY',
    canAccessOpenAI: false,
    message: 'OPENAI_API_KEY is not configured in environment variables',
  }, { status: 503 });
}




















