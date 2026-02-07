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

    // Calculer le prix moyen et revenu total depuis les données réelles
    let avgPrice = 0;
    let totalRevenue = 0;
    if (shop.listings && shop.listings.length > 0) {
      const prices = shop.listings.map((l: any) => l.price).filter((p: number) => p > 0);
      if (prices.length > 0) {
        avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
        // Revenu total = prix moyen × ventes totales
        totalRevenue = avgPrice * (shop.salesCount || 0);
      }
    }

    // Construire le prompt pour GPT-4o
    const prompt = `Tu es un expert e-commerce de niveau international, spécialisé dans l'analyse approfondie de boutiques Etsy. Ta mission est d'analyser cette boutique Etsy en détail et de fournir une analyse stratégique complète, avec une emphase particulière sur les aspects exploitables pour un dropshipper ou un créateur cherchant à comprendre et à battre cette boutique.

═══════════════════════════════════════════════════════════════════════════════
DONNÉES DE LA BOUTIQUE
═══════════════════════════════════════════════════════════════════════════════

${JSON.stringify(shop, null, 2)}

Prix moyen calculé: ${avgPrice.toFixed(2)}€
Revenu total estimé: ${totalRevenue.toFixed(2)}€ (prix moyen × ${shop.salesCount || 0} ventes)

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS DÉTAILLÉES
═══════════════════════════════════════════════════════════════════════════════

1. ANALYSE GLOBALE DE LA BOUTIQUE (10-12 phrases MINIMUM):
   - Analyse la performance globale avec des CHIFFRES CONCRETS
   - Calcule et mentionne le revenu total estimé: prix moyen (${avgPrice.toFixed(2)}€) × ventes totales (${shop.salesCount || 0})
   - Identifie les forces et faiblesses principales avec des exemples précis
   - Évalue le positionnement et la stratégie de la boutique
   - Donne une vision d'ensemble actionnable avec des recommandations chiffrées

2. MÉTRIQUES CLÉS (utilise les données réelles):
   - Nombre total de ventes: ${shop.salesCount || 0}
   - Revenu total estimé: ${totalRevenue.toFixed(2)}€ (calculé: prix moyen ${avgPrice.toFixed(2)}€ × ${shop.salesCount || 0} ventes)
   - Prix moyen des listings: ${avgPrice.toFixed(2)}€
   - Note moyenne: ${shop.rating || 'Non disponible'}/5
   - Nombre d'avis: ${shop.reviewCount || 'Non disponible'}
   - Ancienneté: ${shop.shopAge || 'Non disponible'}
   - Nombre de listings actifs: ${shop.listings?.length || 0}

3. ANALYSE DES LISTINGS (8-10 points MINIMUM):
   - Identifie les best-sellers avec leurs ventes exactes si disponibles
   - Analyse la stratégie de pricing: prix moyen ${avgPrice.toFixed(2)}€, fourchette de prix, positionnement
   - Identifie les patterns SEO dans les titres (mots-clés récurrents, structure)
   - Évalue la qualité des visuels et descriptions
   - Identifie les opportunités d'amélioration avec des exemples concrets

4. TAGS OPTIMISÉS POUR CETTE BOUTIQUE (15 tags MAX):
   - Analyse le type de boutique (suncatchers, jewelry, art, home decor, etc.)
   - Génère 10-15 tags SEO optimisés spécifiques à cette niche
   - Les tags doivent être pertinents pour Etsy et cette catégorie de produits
   - Exemple pour suncatchers: "Acrylic Suncatcher", "Window Hanging", "Stained Glass Style", "Home Decor", etc.
   - Exemple pour jewelry: "Handmade Jewelry", "Unique Design", "Custom", "Personalized", etc.
   - Évite les tags génériques non pertinents

5. FORCES DE LA BOUTIQUE (8-10 points MINIMUM):
   - Liste les forces spécifiques et mesurables avec des chiffres
   - Sois CONCRET et ACTIONNABLE
   - Exemples: "Volume de ventes élevé (${shop.salesCount || 0}+ ventes), preuve sociale massive", "Prix moyen ${avgPrice.toFixed(2)}€ positionné sur le segment ${avgPrice > 25 ? 'premium' : avgPrice > 15 ? 'moyen' : 'accessible'}", "SEO optimisé avec des mots-clés de longue traîne"

6. FAIBLESSES EXPLOITABLES (8-10 points MINIMUM):
   - Identifie les faiblesses exploitables par un nouveau vendeur
   - Points où un nouveau vendeur peut apporter une valeur ajoutée
   - Sois SPÉCIFIQUE et ACTIONNABLE avec des exemples concrets
   - Exemples: "Temps de réponse client parfois lent", "Gamme de produits limitée à ${shop.listings?.length || 0} listings", "Absence de vidéos produits", "Prix ${avgPrice > 20 ? 'élevé' : 'bas'} laissant place à la concurrence"

7. STRATÉGIES POUR LES BATTRE (10-12 points MINIMUM):
   - Propose des stratégies concrètes et actionnables avec des chiffres
   - Chaque stratégie doit être MESURABLE et RÉALISABLE
   - Exemples: "Lancer avec un prix ${(avgPrice * 0.9).toFixed(2)}€ (10% inférieur) pour gagner des parts de marché rapidement", "Investir dans des photos produits professionnelles avec fond blanc", "Créer ${(shop.listings?.length || 0) + 10}+ listings optimisés SEO avec 10-13 tags pertinents"

8. INSIGHTS STRATÉGIQUES (12-15 phrases MINIMUM):
   - Fournis une analyse stratégique globale avec des chiffres précis
   - Mentionne le revenu total estimé: ${totalRevenue.toFixed(2)}€
   - Identifie les opportunités et menaces avec des exemples concrets
   - Sois PRÉCIS avec des chiffres et faits observés
   - Donne une VISION D'ENSEMBLE actionnable avec des recommandations chiffrées

═══════════════════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE STRICT (JSON UNIQUEMENT)
═══════════════════════════════════════════════════════════════════════════════

Tu DOIS répondre UNIQUEMENT en JSON valide avec cette structure exacte:

{
  "shopName": "${shop.shopName}",
  "shopUrl": "${shop.shopUrl}",
  "overview": "10-12 phrases MINIMUM d'analyse globale avec chiffres concrets (mentionne le revenu total ${totalRevenue.toFixed(2)}€)",
  "metrics": {
    "totalSales": ${shop.salesCount || 0},
    "totalRevenue": ${totalRevenue},
    "monthlyRevenue": ${totalRevenue > 0 ? (totalRevenue / 12).toFixed(2) : 0},
    "rating": ${shop.rating || 0},
    "reviewCount": ${shop.reviewCount || 0},
    "shopAge": "${shop.shopAge || 'Inconnu'}",
    "listingsCount": ${shop.listings?.length || 0},
    "averagePrice": ${avgPrice}
  },
  "optimizedTags": ["10-15 tags SEO optimisés spécifiques à cette niche de boutique"],
  "listingsAnalysis": {
    "bestSellers": ["Liste des 3-5 best-sellers avec leurs ventes exactes"],
    "pricingStrategy": "Analyse détaillée de la stratégie de prix avec prix moyen ${avgPrice.toFixed(2)}€ (8-10 phrases)",
    "patterns": ["8-10 patterns SEO observés dans les listings"],
    "opportunities": ["6-8 opportunités identifiées avec exemples concrets"]
  },
  "strengths": ["8-10 forces spécifiques et actionnables avec chiffres"],
  "weaknesses": ["8-10 faiblesses exploitables et actionnables avec exemples"],
  "strategies": ["10-12 stratégies concrètes pour battre cette boutique avec chiffres"],
  "insights": "12-15 phrases MINIMUM d'analyse stratégique globale avec chiffres précis (mentionne ${totalRevenue.toFixed(2)}€ de revenu total)"
}

IMPORTANT:
- Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire
- Tous les textes doivent être en FRANÇAIS
- Sois TRÈS DÉTAILLÉ dans toutes les sections (minimum de phrases/points respectés)
- Évite les généralités, sois SPÉCIFIQUE et ACTIONNABLE avec des CHIFFRES
- Utilise les données réelles fournies, notamment le revenu total calculé: ${totalRevenue.toFixed(2)}€
- Les tags optimisés doivent être spécifiques à la niche de cette boutique (pas génériques)`;

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

