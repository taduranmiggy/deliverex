import { Download, X } from 'lucide-react'

/**
 * Pre-export confirmation modal — UI only.
 * The caller runs the existing download/export function on confirm.
 */
function ExportConfirmModal({
  open,
  onClose,
  onConfirm,
  reportName,
  dateRange = 'All records',
  filters = 'None',
  rows = 0,
  total = null,
  partialNotice = null,
  infoNotice = null,
  confirmLabel = 'Download',
  confirming = false,
  formatValue,
  onFormatChange,
  formatOptions = ['csv', 'xlsx', 'pdf'],
}) {
  if (!open) return null

  const showPartial = partialNotice || (total != null && total > rows)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm export"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        className="dx-pop-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface, #fff)', borderRadius: 14, width: '100%', maxWidth: 440,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--stroke)' }}>
          <strong style={{ fontSize: '0.95rem' }}>Export summary</strong>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', margin: '0 0 14px' }}>
            Review what will be included before downloading.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, margin: 0, fontSize: '0.875rem' }}>
            <dt style={{ color: 'var(--muted)' }}>Report</dt>
            <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{reportName}</dd>
            <dt style={{ color: 'var(--muted)' }}>Date range</dt>
            <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{dateRange}</dd>
            <dt style={{ color: 'var(--muted)' }}>Applied filters</dt>
            <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{filters}</dd>
            <dt style={{ color: 'var(--muted)' }}>Rows in export</dt>
            <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right' }}>
              {Number(rows).toLocaleString()}
              {total != null && total > rows && (
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}> of {Number(total).toLocaleString()} total</span>
              )}
            </dd>
          </dl>
          {formatValue && onFormatChange && (
            <div className="dx-export-format-row" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {formatOptions.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={formatValue === fmt ? 'active' : ''}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: formatValue === fmt ? '1px solid #2563eb' : '1px solid var(--stroke)',
                    background: formatValue === fmt ? '#eff6ff' : '#fff',
                    color: formatValue === fmt ? '#1d4ed8' : 'inherit',
                    fontWeight: formatValue === fmt ? 700 : 500,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => onFormatChange(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
          {infoNotice && (
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: '14px 0 0', lineHeight: 1.5 }}>
              {infoNotice}
            </p>
          )}
          {showPartial && (
            <p style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.75rem', margin: '14px 0 0', lineHeight: 1.5 }}>
              {partialNotice || 'Only the rows currently loaded on this page are exported. Adjust filters or paging to change the selection.'}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--stroke)' }}>
          <button type="button" className="btn-dx-secondary" onClick={onClose} disabled={confirming}>Cancel</button>
          <button type="button" className="btn-dx-primary" onClick={onConfirm} disabled={confirming || rows === 0}>
            <Download size={15} /> {confirming ? 'Exporting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportConfirmModal
