/**
 * NPS & Diners Satisfaction Engine (Phase 29)
 * Calculates Net Promoter Score (NPS), classifies feedback, and manages manager alerts/retention flows.
 */

export type NPSCategory = 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';

export interface NPSStats {
  score: number; // -100 to +100
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
  avgOverallRating: number;
  avgFoodRating: number;
  avgServiceRating: number;
  avgSpeedRating: number;
  avgCleanlinessRating: number;
}

export const POPULAR_SURVEY_TAGS = {
  positive: [
    'Comida deliciosa',
    'Excelente presentación',
    'Entrega súper rápida',
    'Atención de 10',
    'Porciones generosas',
    'Empaque impecable',
    'Calidad insuperable',
  ],
  negative: [
    'Comida fría',
    'Demora en entrega',
    'Faltó un producto',
    'Empaque maltratado',
    'Falta de sazón',
    'Atención deficiente',
    'Temperatura incorrecta',
  ],
} as const;

/**
 * Classifies an NPS score (0-10) into Promoter, Passive, or Detractor.
 */
export function classifyNPS(score: number): NPSCategory {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

/**
 * Checks whether an incoming survey qualifies as an urgent manager recovery alert.
 * Any overall rating <= 3 or NPS score <= 6 triggers an immediate detractor workflow.
 */
export function isDetractorAlert(overallRating: number, npsScore: number): boolean {
  return overallRating <= 3 || npsScore <= 6;
}

/**
 * Calculates aggregated NPS and rating breakdown across a set of surveys.
 */
export function calculateNPSSummary(
  surveys: Array<{
    overallRating: number;
    npsScore: number;
    foodRating?: number | null;
    serviceRating?: number | null;
    speedRating?: number | null;
    cleanlinessRating?: number | null;
  }>
): NPSStats {
  const total = surveys.length;
  if (total === 0) {
    return {
      score: 0,
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      avgOverallRating: 0,
      avgFoodRating: 0,
      avgServiceRating: 0,
      avgSpeedRating: 0,
      avgCleanlinessRating: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  let sumOverall = 0;
  let sumFood = 0;
  let countFood = 0;
  let sumService = 0;
  let countService = 0;
  let sumSpeed = 0;
  let countSpeed = 0;
  let sumClean = 0;
  let countClean = 0;

  for (const s of surveys) {
    sumOverall += s.overallRating;

    if (s.npsScore >= 9) promoters++;
    else if (s.npsScore >= 7) passives++;
    else detractors++;

    if (typeof s.foodRating === 'number' && s.foodRating > 0) {
      sumFood += s.foodRating;
      countFood++;
    }
    if (typeof s.serviceRating === 'number' && s.serviceRating > 0) {
      sumService += s.serviceRating;
      countService++;
    }
    if (typeof s.speedRating === 'number' && s.speedRating > 0) {
      sumSpeed += s.speedRating;
      countSpeed++;
    }
    if (typeof s.cleanlinessRating === 'number' && s.cleanlinessRating > 0) {
      sumClean += s.cleanlinessRating;
      countClean++;
    }
  }

  const promoterPct = Math.round((promoters / total) * 100);
  const passivePct = Math.round((passives / total) * 100);
  const detractorPct = Math.round((detractors / total) * 100);
  const score = promoterPct - detractorPct; // Standard NPS formula: % Promoters - % Detractors

  return {
    score,
    total,
    promoters,
    passives,
    detractors,
    promoterPct,
    passivePct,
    detractorPct,
    avgOverallRating: Number((sumOverall / total).toFixed(1)),
    avgFoodRating: countFood > 0 ? Number((sumFood / countFood).toFixed(1)) : 0,
    avgServiceRating: countService > 0 ? Number((sumService / countService).toFixed(1)) : 0,
    avgSpeedRating: countSpeed > 0 ? Number((sumSpeed / countSpeed).toFixed(1)) : 0,
    avgCleanlinessRating: countClean > 0 ? Number((sumClean / countClean).toFixed(1)) : 0,
  };
}
