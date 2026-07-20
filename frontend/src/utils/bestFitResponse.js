export const BEST_FIT_RECOMMENDATION_LIMIT = 12

/**
 * Cap Best-Fit lists client-side so Fleet Dispatch never shows hundreds of pairings
 * when an older API returns the full driver × vehicle cross product.
 */
export function curateBestFitResponse(res) {
  if (!res || typeof res !== 'object') {
    return res
  }

  const limit = Number(res.meta?.recommendation_limit) || BEST_FIT_RECOMMENDATION_LIMIT
  const all = Array.isArray(res.recommendations) ? res.recommendations : []
  const totalScored = Number(res.meta?.total_scored_pairings) || all.length
  const recommendations = all.slice(0, limit)

  const recommended = res.recommended
    && recommendations.some(
      (row) => row.driver_id === res.recommended.driver_id
        && row.vehicle_id === res.recommended.vehicle_id,
    )
    ? res.recommended
    : (recommendations[0] ?? res.recommended ?? null)

  return {
    ...res,
    recommended,
    recommendations,
    meta: {
      ...(res.meta || {}),
      recommendation_limit: limit,
      total_scored_pairings: totalScored,
      recommendation_count: recommendations.length,
    },
  }
}
