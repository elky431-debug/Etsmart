import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { shop } = body;

    if (!shop || !shop.shopUrl || !shop.shopName) {
      return NextResponse.json(
        { error: 'Invalid shop data provided' },
        { status: 400 }
      );
    }

    console.log('[Shop Analyze] Début analyse pour:', shop.shopName);

    // Construire le prompt pour GPT-4o
    const prompt = `Tu es un expert e-commerce de niveau international, spécialisé dans l'analyse approfondie de boutiques Etsy. Ta mission est d'analyser cette boutique Etsy en détail et de fournir une analyse stratégique complète, avec une emphase particulière sur les aspects exploitables pour un dropshipper ou un créateur cherchant à comprendre et à battre cette boutique.

═══════════════════════════════════════════════════════════════════════════════
DONNÉES DE LA BOUTIQUE
═══════════════════════════════════════════════════════════════════════════════

${JSON.stringify(shop, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS DÉTAILLÉES
═══════════════════════════════════════════════════════════════════════════════

1. ANALYSE GLOBALE DE LA BOUTIQUE (8-10 phrases MINIMUM):
   - Analyse la performance globale de la boutique (ventes, revenus, ancienneté)
   - Identifie les forces et faiblesses principales
   - Évalue le positionnement et la stratégie de la boutique
   - Donne une vision d'ensemble actionnable

2. MÉTRIQUES CLÉS (chiffres concrets):
   - Nombre total de ventes: ${shop.salesCount || 'Non disponible'}
   - Revenu total estimé: ${shop.totalRevenue ? `${shop.totalRevenue.toFixed(2)}€` : 'Non disponible'}
   - Revenu mensuel estimé: ${shop.monthlyRevenue ? `${shop.monthlyRevenue.toFixed(2)}€` : 'Non disponible'}
   - Note moyenne: ${shop.rating || 'Non disponible'}/5
   - Nombre d'avis: ${shop.reviewCount || 'Non disponible'}
   - Ancienneté: ${shop.shopAge || 'Non disponible'}
   - Nombre de listings: ${shop.listings?.length || 0}

3. ANALYSE DES LISTINGS (6-8 points MINIMUM):
   - Identifie les best-sellers (listings avec le plus de ventes)
   - Analyse les prix moyens et la stratégie de pricing
   - Identifie les patterns dans les titres, descriptions, tags
   - Évalue la qualité des visuels et des descriptions
   - Identifie les opportunités (listings peu performants mais avec potentiel)

4. FORCES DE LA BOUTIQUE (6-8 points MINIMUM):
   - Liste les forces spécifiques et mesurables
   - Sois CONCRET et ACTIONNABLE
   - Exemples: "Volume de ventes élevé (${shop.salesCount || 0}+), preuve sociale massive", "Prix positionnés sur le segment premium avec une marge confortable", "SEO optimisé avec des mots-clés de longue traîne"

5. FAIBLESSES EXPLOITABLES (6-8 points MINIMUM):
   - Identifie les faiblesses exploitables par un nouveau vendeur
   - Points où un nouveau vendeur peut apporter une valeur ajoutée
   - Sois SPÉCIFIQUE et ACTIONNABLE
   - Exemples: "Temps de réponse client parfois lent", "Gamme de produits limitée à un seul style", "Absence de vidéos produits"

6. STRATÉGIES POUR LES BATTRE (8-10 points MINIMUM):
   - Propose des stratégies concrètes et actionnables
   - Chaque stratégie doit être MESURABLE et RÉALISABLE
   - Exemples: "Lancer avec un prix 10% inférieur pour gagner des parts de marché rapidement", "Investir dans des photos produits professionnelles avec fond blanc", "Créer 20 listings optimisés SEO avec 10-13 tags pertinents"

7. INSIGHTS STRATÉGIQUES (10-12 phrases MINIMUM):
   - Fournis une analyse stratégique globale
   - Identifie les opportunités et menaces
   - Sois PRÉCIS avec des chiffres et faits observés
   - Donne une VISION D'ENSEMBLE actionnable

═══════════════════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE STRICT (JSON UNIQUEMENT)
═══════════════════════════════════════════════════════════════════════════════

Tu DOIS répondre UNIQUEMENT en JSON valide avec cette structure exacte:

{
  "shopName": "${shop.shopName}",
  "shopUrl": "${shop.shopUrl}",
  "overview": "8-10 phrases MINIMUM d'analyse globale avec chiffres concrets",
  "metrics": {
    "totalSales": ${shop.salesCount || 0},
    "totalRevenue": ${shop.totalRevenue || 0},
    "monthlyRevenue": ${shop.monthlyRevenue || 0},
    "rating": ${shop.rating || 0},
    "reviewCount": ${shop.reviewCount || 0},
    "shopAge": "${shop.shopAge || 'Inconnu'}",
    "listingsCount": ${shop.listings?.length || 0}
  },
  "listingsAnalysis": {
    "bestSellers": ["Liste des 3-5 best-sellers avec leurs ventes"],
    "pricingStrategy": "Analyse de la stratégie de prix (6-8 phrases)",
    "patterns": ["6-8 patterns observés dans les listings"],
    "opportunities": ["4-6 opportunités identifiées"]
  },
  "strengths": ["6-8 forces spécifiques et actionnables"],
  "weaknesses": ["6-8 faiblesses exploitables et actionnables"],
  "strategies": ["8-10 stratégies concrètes pour battre cette boutique"],
  "insights": "10-12 phrases MINIMUM d'analyse stratégique globale avec chiffres et faits observés"
}

IMPORTANT:
- Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire
- Tous les textes doivent être en FRANÇAIS
- Sois TRÈS DÉTAILLÉ dans toutes les sections (minimum de phrases/points respectés)
- Évite les généralités, sois SPÉCIFIQUE et ACTIONNABLE
- Utilise les données réelles fournies, ne les invente pas`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-11-20',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert e-commerce spécialisé dans l\'analyse de boutiques Etsy. Tu réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    const analysisText = completion.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No response from OpenAI');
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('[Shop Analyze] Erreur parsing JSON:', parseError);
      console.error('[Shop Analyze] Réponse OpenAI:', analysisText);
      throw new Error('Invalid JSON response from OpenAI');
    }

    console.log('[Shop Analyze] Analyse terminée avec succès');

    return NextResponse.json({
      success: true,
      shop: {
        name: shop.shopName,
        url: shop.shopUrl,
      },
      analysis,
      rawData: shop,
    });
  } catch (error: any) {
    console.error('[Shop Analyze] Erreur:', error);
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        message: error.message || 'Une erreur est survenue lors de l\'analyse',
      },
      { status: 500 }
    );
  }
}

