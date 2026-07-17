import { apiRequest } from './client'

export function fetchExportPreview(report, filters = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ report, ...filters }).filter(([, v]) => v != null && v !== ''),
    ),
  ).toString()
  return apiRequest(`/exports/preview?${qs}`)
}
