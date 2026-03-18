import { SupabaseClient } from '@supabase/supabase-js';
import { KeywordResearchHistoryItem, KeywordResearchResult } from './types';

interface KeywordHistoryRow {
  id: string;
  user_id: string;
  keyword: string;
  source_url: string;
  data_source?: string | null;
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
  market_size_estimate?: number | null;
  raw_listings: unknown;
  ai_analysis: unknown;
  suggestions: unknown;
  alura_overview?: unknown;
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
  const ds = row.data_source as KeywordResearchHistoryItem['dataSource'] | undefined;
  return {
    id: row.id,
    keyword: row.keyword,
    sourceUrl: row.source_url,
    dataSource: ds === 'alura' || ds === 'etsy' ? ds : undefined,
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
    marketSizeEstimate: row.market_size_estimate ?? null,
    rawListings: (row.raw_listings as KeywordResearchHistoryItem['rawListings']) || null,
    strategicInsights:
      (row.ai_analysis as KeywordResearchHistoryItem['strategicInsights']) || null,
    suggestions: (row.suggestions as string[]) || null,
    aluraOverview: (row.alura_overview as KeywordResearchHistoryItem['aluraOverview']) || null,
    createdAt: row.created_at,
  };
}

const baseHistoryInsert = (userId: string, result: KeywordResearchResult) => ({
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
});

/** PostgREST / Postgres : colonnes optionnelles pas encore migrées */
function shouldRetryInsertWithoutExtendedColumns(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes('data_source') ||
    m.includes('alura_overview') ||
    m.includes('market_size_estimate') ||
    (m.includes('column') &&
      (m.includes('does not exist') ||
        m.includes('unknown') ||
        m.includes('could not find') ||
        m.includes('schema cache')))
  );
}

export async function insertKeywordResearchHistory(
  supabase: SupabaseClient,
  userId: string,
  result: KeywordResearchResult
): Promise<KeywordResearchHistoryItem> {
  const extended = {
    ...baseHistoryInsert(userId, result),
    data_source: result.dataSource,
    market_size_estimate: result.metrics.marketSizeEstimate ?? null,
    alura_overview: result.aluraOverview ?? null,
  };

  let { data, error } = await supabase
    .from('keyword_research_history')
    .insert(extended)
    .select('*')
    .single();

  if (error && shouldRetryInsertWithoutExtendedColumns(error)) {
    ({ data, error } = await supabase
      .from('keyword_research_history')
      .insert(baseHistoryInsert(userId, result))
      .select('*')
      .single());
  }

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
