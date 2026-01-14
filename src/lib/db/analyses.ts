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
      viral_title_en: analysis.seo?.viralTitleEN,
      viral_title_fr: analysis.seo?.viralTitleFR,
      seo_tags: analysis.seo?.seoTags || [],
      launch_simulation: analysis.launchSimulation || null,
      etsy_search_query: analysis.etsySearchQuery,
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
        total_products: analysis.totalProducts,
        total_revenue_3m: analysis.totalRevenue3m,
        total_profit_3m: analysis.totalProfit3m,
        average_margin: analysis.averageMargin,
        dominant_niche: analysis.dominantNiche,
        market_opportunities: analysis.marketOpportunities,
        risk_factors: analysis.riskFactors,
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
  return {
    product: transformProductFromDb(dbAnalysis.products),
    verdict: {
      verdict: dbAnalysis.verdict,
      confidenceScore: dbAnalysis.confidence_score,
      summary: dbAnalysis.summary,
      aiComment: dbAnalysis.ai_comment,
      difficultyAnalysis: dbAnalysis.difficulty_analysis,
      competitionComment: dbAnalysis.competition_comment,
      estimatedSupplierPrice: dbAnalysis.estimated_supplier_price,
      estimatedShippingCost: dbAnalysis.estimated_shipping_cost,
      supplierPriceReasoning: dbAnalysis.supplier_price_reasoning,
    },
    competitors: {
      totalCompetitors: dbAnalysis.total_competitors,
      competitorEstimationReliable: dbAnalysis.competitor_estimation_reliable,
      competitorEstimationReasoning: dbAnalysis.competitor_estimation_reasoning,
      averageMarketPrice: dbAnalysis.average_market_price,
      marketPriceRange: dbAnalysis.market_price_range_min && dbAnalysis.market_price_range_max
        ? { min: dbAnalysis.market_price_range_min, max: dbAnalysis.market_price_range_max }
        : undefined,
      marketStructure: dbAnalysis.market_structure,
    },
    pricing: {
      recommendedPrice: dbAnalysis.recommended_price,
      aggressivePrice: dbAnalysis.aggressive_price,
      premiumPrice: dbAnalysis.premium_price,
      justification: dbAnalysis.pricing_justification,
    },
    saturation: {
      phase: dbAnalysis.saturation_phase,
      saturationProbability: dbAnalysis.saturation_probability,
    },
    marketing: {
      angles: dbAnalysis.marketing_angles || [],
      topKeywords: dbAnalysis.marketing_keywords || [],
      emotionalHooks: dbAnalysis.marketing_hooks || [],
      occasions: dbAnalysis.marketing_occasions || [],
      strategic: dbAnalysis.strategic_marketing,
      acquisition: dbAnalysis.acquisition_marketing,
    },
    seo: {
      viralTitleEN: dbAnalysis.viral_title_en,
      viralTitleFR: dbAnalysis.viral_title_fr,
      seoTags: dbAnalysis.seo_tags || [],
    },
    launchSimulation: dbAnalysis.launch_simulation,
    etsySearchQuery: dbAnalysis.etsy_search_query,
  } as ProductAnalysis;
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

