import { apiRequest } from './client'

export function fetchIssueReports(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/issue-reports${qs ? '?' + qs : ''}`)
}
