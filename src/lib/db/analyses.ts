import { supabase } from '../supabase';
import type { ProductAnalysis, BoutiqueAnalysis, SupplierProduct } from '@/types';

// Analysis operations
export const analysisDb = {
  // Get all analyses for a user
  async getAnalyses(userId: string): Promise<ProductAnalysis[]> {
    const { data, error } = await supabase
      .from('product_analyses')
      .select(`
        *,
        products (*, product_variants (*))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformAnalysisFromDb);
  },

  // Get a single analysis
  async getAnalysis(productId: string, userId: string): Promise<ProductAnalysis | null> {
    const { data, error } = await supabase
      .from('product_analyses')
      .select(`
        *,
        products (*, product_variants (*))
      `)
      .eq('product_id', productId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return transformAnalysisFromDb(data);
  },

  // Save or update an analysis
  async saveAnalysis(userId: string, analysis: ProductAnalysis): Promise<ProductAnalysis> {
    const analysisData = {
      product_id: analysis.product.id,
      user_id: userId,
      verdict: analysis.verdict.verdict,
      confidence_score: analysis.verdict.confidenceScore,
      summary: analysis.verdict.summary,
      ai_comment: analysis.verdict.aiComment,
      difficulty_analysis: analysis.verdict.difficultyAnalysis,
      competition_comment: analysis.verdict.competitionComment,
      total_competitors: analysis.competitors.totalCompetitors,
      competitor_estimation_reliable: analysis.competitors.competitorEstimationReliable,
      competitor_estimation_reasoning: analysis.competitors.competitorEstimationReasoning,
      average_market_price: analysis.competitors.averageMarketPrice,
      market_price_range_min: analysis.competitors.marketPriceRange?.min,
      market_price_range_max: analysis.competitors.marketPriceRange?.max,
      market_structure: analysis.competitors.marketStructure,
      recommended_price: analysis.pricing.recommendedPrice,
      aggressive_price: analysis.pricing.aggressivePrice,
      premium_price: analysis.pricing.premiumPrice,
      pricing_justification: analysis.pricing.justification,
      saturation_phase: analysis.saturation.phase,
      saturation_probability: analysis.saturation.saturationProbability,
      estimated_supplier_price: analysis.verdict.estimatedSupplierPrice,
      estimated_shipping_cost: analysis.verdict.estimatedShippingCost,
      supplier_price_reasoning: analysis.verdict.supplierPriceReasoning,
      marketing_angles: analysis.marketing?.angles || null,
      marketing_keywords: analysis.marketing?.topKeywords || [],
      marketing_hooks: analysis.marketing?.emotionalHooks || [],
      marketing_occasions: analysis.marketing?.occasions || [],
      strategic_marketing: analysis.marketing?.strategic || null,
      acquisition_marketing: analysis.marketing?.acquisition || null,
      viral_title_en: analysis.verdict.viralTitleEN,
      seo_tags: analysis.verdict.seoTags || [],
      launch_simulation: analysis.launchSimulation || null,
      etsy_search_query: analysis.verdict.etsySearchQuery,
      full_analysis_data: analysis, // Store complete analysis as backup
    };

    const { data, error } = await supabase
      .from('product_analyses')
      .upsert(analysisData, {
        onConflict: 'product_id,user_id',
      })
      .select(`
        *,
        products (*, product_variants (*))
      `)
      .single();

    if (error) throw error;

    return transformAnalysisFromDb(data);
  },

  // Delete an analysis
  async deleteAnalysis(productId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('product_analyses')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Get boutique analysis
  async getBoutiqueAnalysis(userId: string): Promise<BoutiqueAnalysis | null> {
    const { data, error } = await supabase
      .from('boutique_analyses')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data.boutique_data as BoutiqueAnalysis;
  },

  // Save boutique analysis
  async saveBoutiqueAnalysis(userId: string, analysis: BoutiqueAnalysis): Promise<void> {
    const { error } = await supabase
      .from('boutique_analyses')
      .upsert({
        user_id: userId,
        boutique_data: analysis,
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
  },
};

// Transform database analysis to app analysis type
function transformAnalysisFromDb(dbAnalysis: any): ProductAnalysis {
  // Reconstruct the full analysis from stored data or build from DB fields
  const fullData = dbAnalysis.full_analysis_data;
  
  if (fullData) {
    // If we have the full data stored, use it (with updated product)
    return {
      ...fullData,
      product: transformProductFromDb(dbAnalysis.products),
    };
  }

  // Otherwise, reconstruct from individual fields
  // This is a simplified version - you may need to adjust based on your types
  const reconstructed: ProductAnalysis = {
    id: dbAnalysis.id || `analysis-${dbAnalysis.product_id}`,
    product: transformProductFromDb(dbAnalysis.products),
    niche: dbAnalysis.products?.niche || 'custom',
    verdict: {
      verdict: dbAnalysis.verdict as 'launch' | 'test' | 'avoid',
      confidenceScore: dbAnalysis.confidence_score,
      summary: dbAnalysis.summary,
      aiComment: dbAnalysis.ai_comment,
      difficultyAnalysis: dbAnalysis.difficulty_analysis,
      competitionComment: dbAnalysis.competition_comment,
      estimatedSupplierPrice: dbAnalysis.estimated_supplier_price,
      estimatedShippingCost: dbAnalysis.estimated_shipping_cost,
      supplierPriceReasoning: dbAnalysis.supplier_price_reasoning,
      viralTitleEN: dbAnalysis.viral_title_en,
      seoTags: dbAnalysis.seo_tags || [],
      etsySearchQuery: dbAnalysis.etsy_search_query || '',
      strengths: [],
      risks: [],
      improvements: [],
    },
    competitors: {
      totalCompetitors: dbAnalysis.total_competitors || 0,
      competitorEstimationReliable: dbAnalysis.competitor_estimation_reliable ?? true,
      competitorEstimationReasoning: dbAnalysis.competitor_estimation_reasoning || '',
      averageMarketPrice: dbAnalysis.average_market_price || 0,
      marketPriceRange: dbAnalysis.market_price_range_min && dbAnalysis.market_price_range_max
        ? { min: dbAnalysis.market_price_range_min, max: dbAnalysis.market_price_range_max }
        : { min: 0, max: 0 },
      marketStructure: dbAnalysis.market_structure as 'dominated' | 'fragmented' | 'open' || 'fragmented',
      competitors: [],
      dominantSellers: 0,
      avgPrice: dbAnalysis.average_market_price || 0,
      priceRange: dbAnalysis.market_price_range_min && dbAnalysis.market_price_range_max
        ? { min: dbAnalysis.market_price_range_min, max: dbAnalysis.market_price_range_max }
        : { min: 0, max: 0 },
      avgReviews: 0,
      avgRating: 0,
      marketPriceReasoning: dbAnalysis.market_price_reasoning || '',
    },
    pricing: {
      recommendedPrice: dbAnalysis.recommended_price || 0,
      aggressivePrice: dbAnalysis.aggressive_price || 0,
      premiumPrice: dbAnalysis.premium_price || 0,
      justification: dbAnalysis.pricing_justification || '',
      currency: 'USD',
      competitorPriceAnalysis: {
        below25: 0,
        median: 0,
        above75: 0,
      },
      priceStrategy: {
        launch: dbAnalysis.aggressive_price || 0,
        stable: dbAnalysis.recommended_price || 0,
        premium: dbAnalysis.premium_price || 0,
      },
      marginAnalysis: {
        atRecommendedPrice: 0,
        atAggressivePrice: 0,
        atPremiumPrice: 0,
      },
    },
    saturation: {
      phase: dbAnalysis.saturation_phase as 'launch' | 'growth' | 'saturation' | 'decline' || 'launch',
      phasePercentage: 0,
      newSellersRate: 0,
      listingGrowthRate: 0,
      saturationProbability: dbAnalysis.saturation_probability || 0,
      estimatedSaturationDate: undefined,
      declineRisk: 'low' as const,
      seasonality: {
        isSeasonalProduct: false,
        peakMonths: [],
        lowMonths: [],
        currentSeasonImpact: 'neutral' as const,
      },
    },
    launchSimulation: dbAnalysis.launch_simulation || {
      timeToFirstSale: {
        withoutAds: { min: 7, max: 14, expected: 10 },
        withAds: { min: 1, max: 3, expected: 2 },
      },
      threeMonthProjection: {
        conservative: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0, marginPercentage: 0 },
        realistic: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0, marginPercentage: 0 },
        optimistic: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0, marginPercentage: 0 },
      },
      successProbability: 50,
      keyFactors: [],
    },
    marketing: {
      angles: dbAnalysis.marketing_angles || [],
      topKeywords: dbAnalysis.marketing_keywords || [],
      emotionalHooks: dbAnalysis.marketing_hooks || [],
      occasions: dbAnalysis.marketing_occasions || [],
      strategic: dbAnalysis.strategic_marketing,
      acquisition: dbAnalysis.acquisition_marketing,
    },
    analyzedAt: new Date(dbAnalysis.created_at || Date.now()),
    analysisVersion: '1.0',
    dataSource: 'real' as const,
  };
  
  return reconstructed;
}

function transformProductFromDb(dbProduct: any) {
  return {
    id: dbProduct.id,
    url: dbProduct.url,
    source: dbProduct.source,
    title: dbProduct.title,
    description: dbProduct.description || '',
    images: dbProduct.images || [],
    price: parseFloat(dbProduct.price),
    currency: dbProduct.currency || 'USD',
    variants: dbProduct.product_variants?.map((v: any) => ({
      id: v.id,
      name: v.name,
      price: parseFloat(v.price),
      image: v.image,
    })) || [],
    category: dbProduct.category || '',
    shippingTime: dbProduct.shipping_time || '',
    minOrderQuantity: dbProduct.min_order_quantity || 1,
    supplierRating: dbProduct.supplier_rating ? parseFloat(dbProduct.supplier_rating) : 0,
    createdAt: new Date(dbProduct.created_at),
  };
}

