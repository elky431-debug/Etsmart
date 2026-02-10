import { NextRequest, NextResponse } from 'next/server';

// Configuration Vercel : timeout de 60 secondes
export const maxDuration = 60;

interface ShopData {
  shopUrl: string;
  shopName: string;
  salesCount?: number;
  rating?: number;
  reviewCount?: number;
  shopAge?: string;
  sampleListings: Array<{
    title: string;
    url: string;
    priceText: string;
  }>;
}

interface AnalysisResponse {
  success: boolean;
  niche: string;
  shopsCount: number;
  analysis: {
    topShops: Array<{
      rank: number;
      shopUrl: string;
      shopName: string;
      whyDominates: string;
      strengths: string[];
      weaknesses: string[];
    }>;
    commonPatterns: string[];
    howToBeatThem: {
      angles: string[];
      actions: string[];
    };
    insights: string;
  };
  shops: ShopData[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Competitors Import] Début de la requête');
    const body = await request.json();
    const { niche, shops, source } = body;
    console.log('[Competitors Import] Données reçues:', { niche, shopsCount: shops?.length, source });

    // Validation
    if (!niche || !shops || !Array.isArray(shops)) {
      return NextResponse.json(
        { error: 'Missing required fields: niche and shops array' },
        { status: 400 }
      );
    }

    // Limiter à 20 boutiques max
    const validShops = shops
      .filter((shop: ShopData) => shop.shopUrl && shop.shopName)
      .slice(0, 20);

    if (validShops.length === 0) {
      return NextResponse.json(
        { error: 'No valid shops provided' },
        { status: 400 }
      );
    }

    // Vérifier la clé OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Préparer les données pour GPT-4o
    const shopsData = validShops.map((shop, index) => ({
      rank: index + 1,
      nom: shop.shopName,
      url: shop.shopUrl,
      ventes: shop.salesCount || 0,
      note: shop.rating || 0,
      avis: shop.reviewCount || 0,
      anciennete: shop.shopAge || 'Inconnue',
      exemplesProduits: (shop.sampleListings || []).map(l => ({
        titre: l.title || 'Sans titre',
        prix: l.priceText || 'Prix non disponible'
      }))
    }));

    // Prompt détaillé pour GPT-4o
    const prompt = `Tu es un expert e-commerce de niveau international, spécialisé dans l'analyse concurrentielle approfondie pour la plateforme Etsy. Ta mission est d'analyser OBJECTIVEMENT ces boutiques Etsy et de fournir une analyse stratégique complète et détaillée.

═══════════════════════════════════════════════════════════════════════════════
CONTEXTE DE L'ANALYSE
═══════════════════════════════════════════════════════════════════════════════

- Niche analysée: ${niche}
- Nombre de boutiques: ${validShops.length}
- Source des données: ${source || 'extension'}

═══════════════════════════════════════════════════════════════════════════════
DONNÉES DES BOUTIQUES
═══════════════════════════════════════════════════════════════════════════════

${JSON.stringify(shopsData, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS DÉTAILLÉES
═══════════════════════════════════════════════════════════════════════════════

1. CLASSEMENT OBJECTIF PAR PERFORMANCE RÉELLE (CRITIQUE):
   ⚠️ RÈGLE ABSOLUE: Tu DOIS classer les boutiques par leur PERFORMANCE RÉELLE, pas par ordre alphabétique ou aléatoire.
   
   Critères de classement (par ordre d'importance):
   a) Nombre de ventes (salesCount) - LE PLUS IMPORTANT
   b) Nombre d'avis (reviewCount) - Indicateur de volume et confiance
   c) Note moyenne (rating) - Qualité perçue
   d) Ancienneté (shopAge) - Expérience et crédibilité
   
   ⚠️ INTERDICTION FORMELLE:
   - NE JAMAIS mettre en #1 une boutique récente avec peu de ventes
   - NE JAMAIS mettre en #1 une boutique avec 0 ventes ou très peu de ventes
   - Si une boutique a 10,000 ventes et une autre 50 ventes, la première DOIT être classée plus haut
   - Le classement DOIT refléter la DOMINATION RÉELLE du marché
   
   Exemple de BON classement:
   - #1: Boutique avec 15,000 ventes, 4.8 étoiles, 2,500 avis, depuis 2018
   - #2: Boutique avec 8,000 ventes, 4.7 étoiles, 1,200 avis, depuis 2020
   - #3: Boutique avec 3,000 ventes, 4.6 étoiles, 500 avis, depuis 2021
   
   Exemple de MAUVAIS classement (À ÉVITER):
   - #1: Boutique avec 50 ventes, 4.5 étoiles, 10 avis, depuis 2024 ❌
   - #2: Boutique avec 15,000 ventes, 4.8 étoiles, 2,500 avis, depuis 2018 ❌

2. ANALYSE DES TOP 10 BOUTIQUES:
   Pour chaque boutique dans le top 10 (classées par performance réelle):
   
   a) whyDominates (5-7 phrases MINIMUM, style analyse stratégique DROPSHIPPING):
      - Interdit: descriptions générales de la boutique (pas de "ils vendent X")
      - Analyse marketing/branding: positionnement, promesse, angle, preuve sociale, réassurance
      - Analyse conversion: titres, prix, visuels, offres, bundles, personnalisation, perception de valeur
      - Analyse growth: volume ventes, avis, ancienneté + vitesse de traction (si détectable)
      - Analyse différenciation: USP, packaging, niche, storytelling, cohérence visuelle
      - Mentionne des CHIFFRES CONCRETS (ventes, avis, note, ancienneté)
      - Format: phrases courtes, orientées "cause → effet"
      - Exemples d’angles à couvrir: branding premium/utile, photo style, pricing psychologique, social proof, assortiment
      - Exemple BON: "Cette boutique verrouille la confiance avec 12,800 ventes et 2,100 avis (4.8/5), ce qui réduit la friction d’achat. Le branding est cohérent (couleurs, ton, univers), donnant une perception premium au-dessus de la moyenne. Les visuels mettent le produit en situation d’usage, ce qui clarifie la valeur et accélère la décision. Le pricing est aligné sur une stratégie “value > price”, donc marge possible sans chuter en conversion. L’offre semble structurée en variantes/bundles, augmentant le panier moyen. L’ancienneté (depuis 2019) renforce l’effet autorité et la répétition d’achat."
   
   b) strengths (6-8 points MINIMUM):
      - Liste les FORCES SPÉCIFIQUES de cette boutique
      - Sois CONCRET et MESURABLE
      - Chaque point doit être ACTIONNABLE
      - Exemples: "Volume de ventes élevé (15,000+)", "Note moyenne excellente (4.8/5)", "Large base de clients (2,500+ avis)", "Ancienneté sur le marché (6 ans)", "Prix compétitifs dans la niche"
      - Évite les généralités comme "Bonne qualité" sans détails
   
   c) weaknesses (4-6 points MINIMUM):
      - Identifie les FAIBLESSES EXPLOITABLES
      - Points où un nouveau vendeur peut se différencier
      - Sois SPÉCIFIQUE et ACTIONNABLE
      - Exemples: "Prix légèrement élevés par rapport à la moyenne", "Temps de réponse client parfois lent (visible dans les avis)", "Gamme de produits limitée à un seul style", "Photos produits peu professionnelles"
      - Évite les faiblesses génériques non exploitables

3. PATTERNS COMMUNS OBSERVÉS (6+ patterns):
   - Identifie les TENDANCES RÉCURRENTES parmi toutes les boutiques
   - Sois SPÉCIFIQUE avec des exemples concrets
   - Chaque pattern doit être OBSERVABLE et MESURABLE
   - Exemples: "80% des boutiques dominantes utilisent des prix entre 15€ et 35€", "Les boutiques avec plus de 5,000 ventes ont toutes une note supérieure à 4.6", "Les descriptions produits incluent systématiquement des mots-clés SEO spécifiques", "Les photos produits utilisent un fond blanc uniforme dans 90% des cas"

4. COMMENT LES BATTRE - ANGLES STRATÉGIQUES (6+ angles):
   - Propose des ANGLES D'ATTAQUE CONCRETS
   - Chaque angle doit être ACTIONNABLE
   - Sois SPÉCIFIQUE à cette niche
   - Exemples: "Se positionner sur un segment premium avec des matériaux haut de gamme", "Cibler un public spécifique non couvert (ex: cadeaux personnalisés pour entreprises)", "Optimiser les coûts pour proposer des prix 15-20% inférieurs", "Améliorer l'expérience client avec un service réactif 24/7"

5. COMMENT LES BATTRE - ACTIONS CONCRÈTES (6+ actions):
   - Liste des ACTIONS MESURABLES à entreprendre
   - Chaque action doit être PRÉCISE et RÉALISABLE
   - Sois SPÉCIFIQUE avec des chiffres ou délais
   - Exemples: "Lancer avec un prix 10% inférieur aux concurrents pour gagner des parts de marché rapidement", "Investir dans des photos produits professionnelles avec fond blanc", "Créer 20 listings optimisés SEO dans les 30 premiers jours", "Mettre en place un système de réduction automatique pour les commandes groupées"

6. INSIGHTS STRATÉGIQUES (8-10 phrases MINIMUM):
   - Fournis une ANALYSE STRATÉGIQUE GLOBALE
   - Identifie les OPPORTUNITÉS et MENACES
   - Sois PRÉCIS avec des chiffres et faits observés
   - Donne une VISION D'ENSEMBLE actionnable
   - Évite les généralités, sois SPÉCIFIQUE à cette niche

═══════════════════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE STRICT (JSON UNIQUEMENT)
═══════════════════════════════════════════════════════════════════════════════

Tu DOIS répondre UNIQUEMENT en JSON valide avec cette structure exacte:

{
  "topShops": [
    {
      "rank": 1,
      "shopUrl": "https://www.etsy.com/shop/...",
      "shopName": "Nom de la boutique",
      "whyDominates": "3-4 phrases MINIMUM expliquant pourquoi cette boutique domine avec des chiffres concrets",
      "strengths": ["4-5 points MINIMUM spécifiques et mesurables"],
      "weaknesses": ["3-4 points MINIMUM exploitables et actionnables"]
    },
    // ... jusqu'à 10 boutiques classées par performance RÉELLE
  ],
  "commonPatterns": [
    "4+ patterns observés avec des exemples concrets et mesurables"
  ],
  "howToBeatThem": {
    "angles": [
      "4+ angles stratégiques actionnables et spécifiques à la niche"
    ],
    "actions": [
      "4+ actions concrètes mesurables avec chiffres ou délais"
    ]
  },
  "insights": "5-6 phrases MINIMUM d'analyse stratégique globale avec chiffres et faits observés, spécifique à cette niche"
}

IMPORTANT: 
- Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire
- Le classement DOIT être objectif par performance réelle (ventes, avis, notes, ancienneté)
- Tous les textes doivent être en FRANÇAIS
- Sois TRÈS DÉTAILLÉ dans toutes les sections (minimum de phrases/points respectés)
- Évite les généralités, sois SPÉCIFIQUE et ACTIONNABLE`;

    // Appel à OpenAI GPT-4o avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 secondes pour laisser une marge

    let openaiResponse;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-2024-11-20',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert e-commerce et analyse concurrentielle spécialisé dans Etsy. Tu analyses objectivement les boutiques et fournis des insights stratégiques détaillés en français. Tu réponds UNIQUEMENT en JSON valide.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        console.error('[Competitors Import] ❌ Timeout OpenAI (50s)');
        return NextResponse.json(
          { 
            error: 'Timeout',
            message: 'L\'analyse prend trop de temps. Veuillez réessayer avec moins de boutiques ou patienter quelques instants.',
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('[Competitors Import] ❌ Erreur OpenAI:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        errorData: JSON.stringify(errorData).substring(0, 500)
      });
      return NextResponse.json(
        { error: 'OpenAI API error', details: errorData },
        { status: openaiResponse.status }
      );
    }

    const openaiData = await openaiResponse.json();
    const analysisText = openaiData.choices[0]?.message?.content;

    if (!analysisText) {
      return NextResponse.json(
        { error: 'No analysis generated' },
        { status: 500 }
      );
    }

    // Parser la réponse JSON
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
      console.log('[Competitors Import] ✅ Analyse parsée avec succès');
    } catch (parseError) {
      console.error('[Competitors Import] ❌ Erreur parsing JSON:', parseError);
      console.error('[Competitors Import] Réponse OpenAI (premiers 500 chars):', analysisText?.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON response from OpenAI', details: String(parseError) },
        { status: 500 }
      );
    }

    // Construire la réponse finale
    const response: AnalysisResponse = {
      success: true,
      niche,
      shopsCount: validShops.length,
      analysis: {
        topShops: analysis.topShops || [],
        commonPatterns: analysis.commonPatterns || [],
        howToBeatThem: {
          angles: analysis.howToBeatThem?.angles || [],
          actions: analysis.howToBeatThem?.actions || [],
        },
        insights: analysis.insights || '',
      },
      shops: validShops,
    };

    console.log('[Competitors Import] ✅ Analyse terminée avec succès:', {
      niche,
      shopsCount: validShops.length,
      topShopsCount: response.analysis.topShops.length
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Competitors Import] ❌ Erreur interne:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: String(error)
    });
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message || 'Une erreur inattendue s\'est produite',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

