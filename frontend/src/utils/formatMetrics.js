/** Safe percentage display — clamps impossible values and handles null/NaN. */
export function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const clamped = Math.min(100, Math.max(0, Number(value)))
  return `${Number.isInteger(clamped) ? clamped : clamped.toFixed(1)}%`
}

/** Safe hours display. */
export function formatHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const hrs = Math.max(0, Number(value))
  return `${hrs.toFixed(1)} hrs`
}

/** Safe score display (0–100). */
export function formatScore(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const score = Math.min(100, Math.max(0, Number(value)))
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

/**
 * Build trend label from API trend object.
 * @param {{ delta?: number|null, direction?: string|null }|null|undefined} trend
 * @param {{ suffix?: string, invert?: boolean }} options
 */
export function formatTrend(trend, { suffix = '%', invert = false } = {}) {
  if (!trend || trend.delta == null || trend.direction == null) return null

  if (trend.direction === 'flat') {
    return { text: 'No change vs prior period', type: 'flat' }
  }

  const improved = invert ? trend.direction === 'down' : trend.direction === 'up'
  const sign = trend.direction === 'up' ? '+' : '−'

  return {
    text: `${sign}${trend.delta}${suffix} vs prior period`,
    type: improved ? 'up' : 'down',
  }
}

export function hasChartData(data) {
  return Array.isArray(data) && data.some((row) => Number(row?.count ?? row?.value ?? 0) > 0)
}
