import { useState } from 'react'
import { IconChart, IconDoc, IconClipboard, IconUsers, IconDownloadSimple } from '../../components/DxIcons'

function escapeCsvCell(v) {
  const s = String(v ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename, headers, rows) {
  const head = headers.map(escapeCsvCell).join(',')
  const lines = rows.map((r) => r.map((c) => escapeCsvCell(c)).join(','))
  const csv = `\uFEFF${[head, ...lines].join('\r\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const REPORT_KEYS = /** @type {const} */ ([
  'deliveries',
  'revenue',
  'ocr',
  'driver_performance',
])

const REPORT_DEF = {
  deliveries: {
    label: 'Deliveries Report',
    description: 'Complete delivery history with details.',
    Icon: IconDoc,
    previewTitle: 'Deliveries Report – Preview',
    headers: ['Job ID', 'Client', 'Material', 'Amount', 'Status'],
    preview: [
      ['J-2023-001', 'Maria Santos', 'Gravel', '₱12,450.00', 'Completed'],
      ['J-2023-002', 'ACME Corp', 'Sand', '₱8,200.00', 'Pending'],
      ['J-2026-004', 'BuildRight Inc.', 'Cement', '₱18,900.00', 'Completed'],
    ],
    full: [
      ['J-2023-001', 'Maria Santos', 'Gravel', '₱12,450.00', 'Completed'],
      ['J-2023-002', 'ACME Corp', 'Sand', '₱8,200.00', 'Pending'],
      ['J-2026-003', 'Northwind', 'Aggregate', '₱9,750.00', 'In transit'],
      ['J-2026-004', 'BuildRight Inc.', 'Cement', '₱18,900.00', 'Completed'],
      ['J-2026-015', 'Providential', 'Base course', '₱22,100.00', 'Scheduled'],
    ],
  },
  revenue: {
    label: 'Revenue Report',
    description: 'Financial summary and revenue breakdown.',
    Icon: IconChart,
    previewTitle: 'Revenue Report – Preview',
    headers: ['Period', 'Region', 'Gross (₱)', 'Fees (₱)', 'Net (₱)', 'Growth'],
    preview: [
      ['Jan 2026', 'NCR', '₱842,400', '₱42,120', '₱800,280', '+4.2%'],
      ['Feb 2026', 'NCR', '₱901,050', '₱45,050', '₱856,000', '+7.1%'],
    ],
    full: [
      ['Jan 2026', 'NCR', '₱842,400', '₱42,120', '₱800,280', '+4.2%'],
      ['Feb 2026', 'NCR', '₱901,050', '₱45,050', '₱856,000', '+7.1%'],
      ['Mar 2026', 'Central Luzon', '₱312,880', '₱15,640', '₱297,240', '+2.0%'],
    ],
  },
  ocr: {
    label: 'OCR Throughput',
    description: 'Document validation statistics.',
    Icon: IconClipboard,
    previewTitle: 'OCR Throughput – Preview',
    headers: ['Date', 'Scanned', 'Passed', 'Flagged', 'Avg. time (s)'],
    preview: [
      ['Feb 18, 2026', '128', '119', '9', '3.2'],
      ['Feb 19, 2026', '144', '136', '8', '2.9'],
    ],
    full: [
      ['Feb 18, 2026', '128', '119', '9', '3.2'],
      ['Feb 19, 2026', '144', '136', '8', '2.9'],
      ['Feb 20, 2026', '151', '142', '9', '3.0'],
    ],
  },
  driver_performance: {
    label: 'Driver Performance',
    description: 'Driver efficiency and on-time metrics.',
    Icon: IconUsers,
    previewTitle: 'Driver Performance – Preview',
    headers: ['Driver', 'Completed runs', 'On-time %', 'Avg. duration', 'Incidents'],
    preview: [
      ['Juan Dela Cruz', '48', '94%', '2h 12m', '0'],
      ['Carlo Mendoza', '41', '98%', '2h 04m', '1'],
    ],
    full: [
      ['Juan Dela Cruz', '48', '94%', '2h 12m', '0'],
      ['Carlo Mendoza', '41', '98%', '2h 04m', '1'],
      ['Maria Lopez', '36', '89%', '2h 28m', '2'],
      ['Ana Ramos', '29', '100%', '1h 55m', '0'],
    ],
  },
}

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState(/** @type {typeof REPORT_KEYS[number]} */ ('deliveries'))
  const [format, setFormat] = useState('CSV')

  const def = REPORT_DEF[reportKey]

  const handleExport = () => {
    const slug =
      format === 'CSV'
        ? `${reportKey}-${new Date().toISOString().slice(0, 10)}.csv`
        : `${reportKey}-${new Date().toISOString().slice(0, 10)}`
    if (format === 'CSV') {
      downloadCsv(slug, def.headers, def.full)
      return
    }
    // Placeholder until server-side PDF endpoints exist.
    alert('PDF export requires a backend report job. CSV is ready now.')
  }

  return (
    <section className="dx-reports-scope">
      <header className="page-header">
        <div className="header-stack">
          <h1>Reports</h1>
          <p>Generate and export detailed reports</p>
        </div>
      </header>

      <div className="dx-report-tabs">
        {REPORT_KEYS.map((key) => {
          const d = REPORT_DEF[key]
          const IconCmp = d.Icon
          const active = key === reportKey
          return (
            <button
              key={key}
              type="button"
              className={`dx-report-tab ${active ? 'dx-report-tab--active' : ''}`}
              onClick={() => setReportKey(key)}
            >
              <span className="dx-report-tab-icon" aria-hidden>
                <IconCmp />
              </span>
              <div className="dx-report-tab-copy">
                <strong>{d.label}</strong>
                <span>{d.description}</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="dx-panel" style={{ marginTop: 18 }}>
        <div className="dx-reports-export-row">
          <label className="dx-reports-format">
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Export format">
              <option value="CSV">CSV</option>
              <option value="PDF">PDF</option>
            </select>
          </label>
          <button className="btn primary" type="button" onClick={handleExport}>
            <span className="dx-reports-export-icon" aria-hidden>
              <IconDownloadSimple />
            </span>
            Export {def.label}
          </button>
        </div>

        <h3 style={{ margin: '22px 0 6px', fontSize: '1.0625rem' }}>{def.previewTitle}</h3>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.875rem' }}>
          Sample data from the selected report.
        </p>

        <div className="table dx-reports-table">
          <div
            className="table-row head"
            style={{
              gridTemplateColumns: `repeat(${def.headers.length}, minmax(0, 1fr))`,
            }}
          >
            {def.headers.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          {def.preview.map((row, i) => (
            <div
              key={i}
              className="table-row"
              style={{
                gridTemplateColumns: `repeat(${def.headers.length}, minmax(0, 1fr))`,
              }}
            >
              {row.map((cell, j) => (
                <span key={j}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          Showing sample data. Full report will be generated on export.
        </p>
      </div>

      <style>{`
        .dx-reports-scope .dx-report-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1024px) {
          .dx-reports-scope .dx-report-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .dx-reports-scope .dx-report-tabs {
            grid-template-columns: 1fr;
          }
        }
        .dx-report-tab {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          text-align: left;
          padding: 14px 16px;
          border-radius: 12px;
          border: 2px solid var(--stroke, #e4e7ec);
          background: #fff;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          font: inherit;
        }
        .dx-report-tab:hover {
          border-color: #c5ced9;
        }
        .dx-report-tab--active {
          border-color: #2d54b7;
          box-shadow: 0 0 0 1px rgba(45, 84, 183, 0.12);
        }
        .dx-report-tab-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(45, 84, 183, 0.1);
          display: grid;
          place-items: center;
          color: #2d54b7;
        }
        .dx-report-tab-icon svg {
          width: 22px;
          height: 22px;
        }
        .dx-report-tab-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .dx-report-tab-copy strong {
          font-size: 0.9375rem;
          color: var(--text, #111827);
        }
        .dx-report-tab-copy span {
          font-size: 0.8125rem;
          color: var(--muted);
          line-height: 1.4;
        }
        .dx-reports-export-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
        }
        .dx-reports-format {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .dx-reports-format select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--stroke, #e4e7ec);
          font: inherit;
          min-width: 160px;
        }
        .dx-reports-export-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          vertical-align: middle;
          color: currentColor;
        }
        .dx-reports-export-icon svg {
          width: 18px;
          height: 18px;
        }
        .dx-reports-table .table-row {
          display: grid;
          align-items: center;
        }
      `}</style>
    </section>
  )
}
