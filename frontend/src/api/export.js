import { apiRequest } from './client'

function appendParam(qs, key, value) {
  if (value == null || value === '' || value === 'all') return
  if (Array.isArray(value)) {
    value.filter(Boolean).forEach((item) => qs.append(`${key}[]`, item))
    return
  }
  qs.set(key, String(value))
}

export function buildExportQuery(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => appendParam(qs, key, value))
  return qs.toString()
}

export function fetchExportPreview(report, filters = {}) {
  const qs = buildExportQuery({ report, ...filters })
  return apiRequest(`/exports/preview?${qs}`)
}
