import { SupabaseClient } from '@supabase/supabase-js';
import { KeywordResearchHistoryItem, KeywordResearchResult } from './types';

interface KeywordHistoryRow {
  id: string;
  user_id: string;
  keyword: string;
  source_url: string;
  demand_score: number;
  competition_score: number;
  opportunity_score: number;
  saturation_level: string;
  difficulty: string;
  verdict: string;
  average_price: number;
  average_reviews: number;
  top_shops_concentration: number;
  listings_count: number;
  raw_listings: unknown;
  ai_analysis: unknown;
  suggestions: unknown;
  created_at: string;
}

function isMissingKeywordHistoryTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    message.includes("could not find the table 'public.keyword_research_history'") ||
    message.includes('relation "public.keyword_research_history" does not exist')
  );
}

function mapRow(row: KeywordHistoryRow): KeywordResearchHistoryItem {
  return {
    id: row.id,
    keyword: row.keyword,
    sourceUrl: row.source_url,
    demandScore: row.demand_score,
    competitionScore: row.competition_score,
    opportunityScore: row.opportunity_score,
    saturationLevel: row.saturation_level as KeywordResearchHistoryItem['saturationLevel'],
    difficulty: row.difficulty as KeywordResearchHistoryItem['difficulty'],
    verdict: row.verdict as KeywordResearchHistoryItem['verdict'],
    averagePrice: row.average_price,
    averageReviews: row.average_reviews,
    topShopsConcentration: row.top_shops_concentration,
    listingsCount: row.listings_count,
    rawListings: (row.raw_listings as KeywordResearchHistoryItem['rawListings']) || null,
    strategicInsights:
      (row.ai_analysis as KeywordResearchHistoryItem['strategicInsights']) || null,
    suggestions: (row.suggestions as string[]) || null,
    createdAt: row.created_at,
  };
}

export async function insertKeywordResearchHistory(
  supabase: SupabaseClient,
  userId: string,
  result: KeywordResearchResult
): Promise<KeywordResearchHistoryItem> {
  const { data, error } = await supabase
    .from('keyword_research_history')
    .insert({
      user_id: userId,
      keyword: result.keyword,
      source_url: result.sourceUrl,
      demand_score: result.scores.demandScore,
      competition_score: result.scores.competitionScore,
      opportunity_score: result.scores.opportunityScore,
      saturation_level: result.scores.saturationLevel,
      difficulty: result.scores.difficulty,
      verdict: result.scores.verdict,
      average_price: result.metrics.averagePrice,
      average_reviews: result.metrics.averageReviewCount,
      top_shops_concentration: result.metrics.topShopsConcentration,
      listings_count: result.metrics.listingsCount,
      raw_listings: result.listings,
      ai_analysis: result.strategicInsights,
      suggestions: result.suggestions,
    })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingKeywordHistoryTable(error)) {
      throw new Error(
        "La table Supabase 'keyword_research_history' n'existe pas encore. Exécute le SQL: supabase/create_keyword_research_history_table.sql"
      );
    }
    throw new Error(error?.message || "Impossible d'enregistrer l'historique keyword");
  }
  return mapRow(data as KeywordHistoryRow);
}

export async function getKeywordResearchHistory(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 30
): Promise<KeywordResearchHistoryItem[]> {
  const { data, error } = await supabase
    .from('keyword_research_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (isMissingKeywordHistoryTable(error)) return [];
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapRow(row as KeywordHistoryRow));
}

export async function getKeywordResearchById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<KeywordResearchHistoryItem | null> {
  const { data, error } = await supabase
    .from('keyword_research_history')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (isMissingKeywordHistoryTable(error)) return null;
  if (error) throw new Error(error.message);
  return data ? mapRow(data as KeywordHistoryRow) : null;
}
