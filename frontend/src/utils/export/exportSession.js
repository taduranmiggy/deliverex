const STORAGE_KEY = 'deliverex_export_session'

export function loadExportSession(reportKey) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.[reportKey] ?? null
  } catch {
    return null
  }
}

export function saveExportSession(reportKey, state) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[reportKey] = {
      datePreset: state.datePreset,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      allRecords: state.allRecords,
      format: state.format,
      filters: state.filters,
      savedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota / private mode */
  }
}
