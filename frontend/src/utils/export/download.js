/** Download a blob returned from the API as a file. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename })
  anchor.click()
  URL.revokeObjectURL(url)
}

export function escapeCsv(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsv(filename, headers, rows) {
  const csv = `\uFEFF${[headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\r\n')}`
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

/** Opens the browser print dialog for the current report panel. */
export function printReportPanel(selector = '.dx-report-print-area') {
  const area = document.querySelector(selector)
  if (!area) {
    window.print()
    return
  }
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
  if (!printWindow) {
    window.print()
    return
  }
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Deliverex Report</title>
    <style>
      body { font-family: system-ui, sans-serif; color: #0f172a; margin: 24px; }
      h1 { font-size: 1.25rem; margin: 0 0 4px; }
      .meta { color: #64748b; font-size: 0.8125rem; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
      th { background: #f1f5f9; text-transform: uppercase; font-size: 0.6875rem; letter-spacing: 0.04em; }
      tr:nth-child(even) td { background: #f8fafc; }
      @media print { body { margin: 12mm; } }
    </style></head><body>${area.innerHTML}</body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}
