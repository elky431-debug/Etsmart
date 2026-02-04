import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint de test pour vérifier les permissions de la clé API Nanonbanana
 */
export async function GET(request: NextRequest) {
  try {
    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';
    
    if (!NANONBANANA_API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'NANONBANANA_API_KEY non configurée',
          hasKey: false 
        },
        { status: 500 }
      );
    }
    
    console.log('[TEST API] Testing Nanonbanana API key permissions...');
    console.log('[TEST API] API Key (first 10 chars):', NANONBANANA_API_KEY.substring(0, 10) + '...');
    
    // Tester plusieurs endpoints pour vérifier les permissions
    const testEndpoints = [
      {
        name: 'Get Account Credits',
        url: 'https://api.nanobananaapi.ai/api/v1/common/credit',
        method: 'GET',
      },
      {
        name: 'Get Task Details (test)',
        url: 'https://api.nanobananaapi.ai/api/v1/nanobanana/record-info',
        method: 'GET',
      },
    ];
    
    const results: any[] = [];
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`[TEST API] Testing ${endpoint.name}...`);
        
        const headers: any = {
          'Content-Type': 'application/json',
        };
        
        // Essayer différents formats d'authentification
        const authFormats = [
          { 'Authorization': `Bearer ${NANONBANANA_API_KEY}` },
          { 'X-API-Key': NANONBANANA_API_KEY },
          { 'api-key': NANONBANANA_API_KEY },
        ];
        
        let success = false;
        let lastError: any = null;
        
        for (const authHeader of authFormats) {
          try {
            const response = await fetch(endpoint.url, {
              method: endpoint.method,
              headers: {
                ...headers,
                ...authHeader,
              },
            });
            
            const responseText = await response.text();
            let responseData: any;
            
            try {
              responseData = JSON.parse(responseText);
            } catch {
              responseData = { raw: responseText };
            }
            
            console.log(`[TEST API] ${endpoint.name} - Status: ${response.status}`);
            console.log(`[TEST API] ${endpoint.name} - Response:`, JSON.stringify(responseData).substring(0, 500));
            
            if (response.ok) {
              results.push({
                endpoint: endpoint.name,
                status: response.status,
                success: true,
                authFormat: Object.keys(authHeader)[0],
                data: responseData,
              });
              success = true;
              break;
            } else if (response.status === 403) {
              results.push({
                endpoint: endpoint.name,
                status: response.status,
                success: false,
                authFormat: Object.keys(authHeader)[0],
                error: 'HTTP 403: Permissions insuffisantes ou IP non whitelistée',
                data: responseData,
              });
              lastError = { status: 403, message: 'Forbidden' };
            } else if (response.status === 401) {
              results.push({
                endpoint: endpoint.name,
                status: response.status,
                success: false,
                authFormat: Object.keys(authHeader)[0],
                error: 'HTTP 401: Clé API invalide',
                data: responseData,
              });
              lastError = { status: 401, message: 'Unauthorized' };
            } else {
              lastError = { status: response.status, message: response.statusText, data: responseData };
            }
          } catch (fetchError: any) {
            lastError = fetchError;
            continue;
          }
        }
        
        if (!success && lastError) {
          results.push({
            endpoint: endpoint.name,
            success: false,
            error: lastError.message || `HTTP ${lastError.status}`,
            details: lastError,
          });
        }
      } catch (error: any) {
        results.push({
          endpoint: endpoint.name,
          success: false,
          error: error.message,
        });
      }
    }
    
    // Résumé
    const hasPermissions = results.some(r => r.success);
    const has403Errors = results.some(r => r.status === 403);
    const has401Errors = results.some(r => r.status === 401);
    
    return NextResponse.json({
      success: hasPermissions,
      hasKey: true,
      apiKey: NANONBANANA_API_KEY.substring(0, 10) + '...',
      summary: {
        hasPermissions,
        has403Errors,
        has401Errors,
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
      },
      results,
      recommendations: has403Errors 
        ? [
            'Vérifiez que votre IP est whitelistée sur nanobananaapi.ai',
            'Allez dans votre dashboard → API Key → Add Whitelist',
            'Ajoutez votre IP publique: 128.79.131.21',
          ]
        : has401Errors
        ? [
            'La clé API semble invalide',
            'Vérifiez que la clé est correcte dans votre .env.local',
            'Générez une nouvelle clé sur nanobananaapi.ai si nécessaire',
          ]
        : hasPermissions
        ? [
            '✅ La clé API a les permissions nécessaires',
            'Vous pouvez générer des images',
          ]
        : [
            'Impossible de vérifier les permissions',
            'Vérifiez votre connexion internet',
            'Vérifiez que l\'API Nanonbanana est accessible',
          ],
    });
  } catch (error: any) {
    console.error('[TEST API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        hasKey: !!process.env.NANONBANANA_API_KEY,
      },
      { status: 500 }
    );
  }
}

