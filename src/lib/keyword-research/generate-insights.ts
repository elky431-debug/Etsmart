import OpenAI from 'openai';
import {
  EtsyKeywordListing,
  KeywordMetrics,
  KeywordScores,
  KeywordStrategicInsights,
} from './types';
import { fallbackStrategicInsights } from './score-keyword';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidInsights(obj: unknown): obj is KeywordStrategicInsights {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.summary === 'string' &&
    Array.isArray(o.strengths) &&
    Array.isArray(o.weaknesses) &&
    Array.isArray(o.recommendations) &&
    typeof o.strategicAngle === 'string' &&
    typeof o.verdictExplanation === 'string'
  );
}

export async function generateKeywordInsights(params: {
  keyword: string;
  listings: EtsyKeywordListing[];
  metrics: KeywordMetrics;
  scores: KeywordScores;
}): Promise<KeywordStrategicInsights> {
  const { keyword, listings, metrics, scores } = params;

  const fallback = fallbackStrategicInsights(keyword, metrics, scores);
  if (!openai) return fallback;

  const reducedListings = listings.slice(0, 12).map((l) => ({
    rank: l.rank,
    title: l.title,
    price: l.price,
    reviews: l.reviewCount,
    rating: l.rating,
    shop: l.shopName,
    bestSeller: l.isBestSeller,
  }));

  const prompt = `
Analyse ce keyword Etsy et retourne UNIQUEMENT du JSON valide.

Keyword: ${keyword}

Scores:
- globalScore: ${scores.globalScore}/100
- intentScore: ${scores.intentScore}/100
- demandScore: ${scores.demandScore}/100
- competitionScore: ${scores.competitionScore}/100
- opportunityScore: ${scores.opportunityScore}/100
- saturationLevel: ${scores.saturationLevel}
- difficulty: ${scores.difficulty}
- buyerIntentLevel: ${scores.buyerIntentLevel}
- keywordShape: ${scores.keywordShape}
- verdict: ${scores.verdict}

Metrics:
- averagePrice: ${metrics.averagePrice}
- averageReviewCount: ${metrics.averageReviewCount}
- topShopsConcentration: ${metrics.topShopsConcentration}%
- listingsCount: ${metrics.listingsCount}

Top listings sample:
${JSON.stringify(reducedListings, null, 2)}

Format JSON strict:
{
  "summary": "string",
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "recommendations": ["string", "string", "string"],
  "strategicAngle": "string",
  "verdictExplanation": "string"
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un expert Etsy growth. Réponds uniquement en JSON strict, sans texte hors JSON.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content || '';
    const parsed = safeParseJson<KeywordStrategicInsights>(text);
    if (parsed && isValidInsights(parsed)) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}
