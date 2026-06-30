import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAssignmentAuditTrails } from '../../api/assignmentAudit'
import { fetchAnalytics, fetchReports } from '../../api/manager'
import ExportConfirmModal from '../../components/ExportConfirmModal'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../../components/ui'
import { ClipboardList, Download, FileText, Users } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatEventAt } from '../../utils/deliveryTimestamps'

const STATUS_LABELS = {
  completed: 'Completed',
  in_progress: 'In Progress',
  assigned: 'Assigned',
  cancelled: 'Cancelled',
}

/** Derives a "earliest – latest" range from a date field across rows (read-only). */
function dateRangeFrom(items, key) {
  const dates = (items ?? [])
    .map((i) => i?.[key])
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
  if (dates.length === 0) return null
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  return `${min.toLocaleDateString()} – ${max.toLocaleDateString()}`
}

function escapeCsv(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename, headers, rows) {
  const csv = `\uFEFF${[headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n')}`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: filename })
  a.click()
}

const TABS = [
  { key: 'deliveries', label: 'Deliveries', Icon: FileText, desc: 'Complete delivery history' },
  { key: 'driver_perf', label: 'Driver Performance', Icon: Users, desc: 'Driver efficiency metrics' },
  { key: 'assignment_audit', label: 'Assignment Audit', Icon: ClipboardList, desc: 'Best-Fit vs actual assignments' },
]

function ReportsPage() {
  const [tab, setTab]         = useState('deliveries')
  const [deliveries, setDeliveries] = useState([])
  const [analytics, setAnalytics]   = useState(null)
  const [auditTrails, setAuditTrails] = useState([])
  const [auditMeta, setAuditMeta] = useState({ last_page: 1, total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [page, setPage]       = useState(1)
  const [meta, setMeta]       = useState({ last_page: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [showExportSummary, setShowExportSummary] = useState(false)

  const loadDeliveries = useCallback(async (p = 1, s = '') => {
    setLoading(true); setError('')
    try {
      const res = await fetchReports(p, s)
      setDeliveries(res.data || [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      setAnalytics(await fetchAnalytics({ drivers_page: 1, drivers_per_page: 6 }))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const loadAuditTrails = useCallback(async (p = 1) => {
    setLoading(true); setError('')
    try {
      const res = await fetchAssignmentAuditTrails({ page: p, per_page: 6 })
      setAuditTrails(res.data || [])
      setAuditMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'deliveries') loadDeliveries(page, statusFilter)
    else if (tab === 'driver_perf') loadAnalytics()
    else loadAuditTrails(page)
  }, [tab, page]) // eslint-disable-line

  // Pre-export summary reflects exactly what the CSV download will contain
  // (the export serializes the currently-loaded rows).
  const exportSummary = useMemo(() => {
    if (tab === 'deliveries') {
      return {
        report: 'Deliveries',
        filters: statusFilter ? STATUS_LABELS[statusFilter] ?? statusFilter : 'All statuses',
        rows: deliveries.length,
        total: meta.total,
        dateRange: dateRangeFrom(deliveries, 'assigned_event_at') ?? dateRangeFrom(deliveries, 'assigned_at') ?? 'All records',
      }
    }
    if (tab === 'driver_perf') {
      const rows = analytics?.drivers ?? []
      return {
        report: 'Driver Performance',
        filters: 'None',
        rows: rows.length,
        total: analytics?.drivers_pagination?.total ?? rows.length,
        dateRange: analytics?.driver_performance?.period
          ? `${analytics.driver_performance.period.from} – ${analytics.driver_performance.period.to}`
          : 'All records',
      }
    }
    return {
      report: 'Assignment Audit',
      filters: 'None',
      rows: auditTrails.length,
      total: auditMeta.total,
      dateRange: dateRangeFrom(auditTrails, 'created_at') ?? 'All records',
    }
  }, [tab, statusFilter, deliveries, analytics, auditTrails, meta.total, auditMeta.total])

  const handleConfirmExport = () => {
    handleExport()
    setShowExportSummary(false)
  }

  const handleExport = () => {
    if (tab === 'deliveries') {
      downloadCsv(`deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Assignment', 'Client', 'Driver', 'Vehicle', 'Status', 'Assigned', 'Completed'],
        deliveries.map((d) => [
          d.id, buildDisplayName(d.job_order) || '—', d.driver?.user?.name ?? '—', d.vehicle?.plate_no ?? '—',
          d.status,
          formatEventAt({ assigned_event_at: d.assigned_event_at, assigned_at: d.assigned_at }) ?? '—',
          formatEventAt({ completed_event_at: d.completed_event_at, completed_at: d.completed_at }) ?? '—',
        ])
      )
    } else if (tab === 'driver_perf') {
      const rows = analytics?.drivers ?? []
      downloadCsv(`driver-performance-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Driver', 'Score', 'Total Jobs', 'Completed', 'Completion %', 'On-Time Rate', 'Delay Rate', 'OCR Accuracy', 'Availability'],
        rows.map((d) => [
          d.name,
          d.reliability_score ?? '—',
          d.total,
          d.completed,
          d.completion_pct != null ? `${d.completion_pct}%` : '—',
          d.on_time_pct != null ? `${d.on_time_pct}%` : '—',
          d.delay_rate_pct != null ? `${d.delay_rate_pct}%` : '—',
          d.ocr_accuracy_pct != null ? `${d.ocr_accuracy_pct}%` : '—',
          d.availability,
        ])
      )
    } else {
      downloadCsv(`assignment-audit-${new Date().toISOString().slice(0, 10)}.csv`,
        ['When', 'Dispatcher', 'Job', 'Best-Fit Driver', 'Best-Fit Vehicle', 'Assigned Driver', 'Assigned Vehicle', 'Override', 'Reason'],
        auditTrails.map((t) => [
          t.created_at ? new Date(t.created_at).toLocaleString() : '—',
          t.dispatcher_name ?? '—',
          t.job_order_id ? formatJobPublicId(t.job_order_id) : '—',
          t.recommended_driver_name ?? '—',
          t.recommended_vehicle_plate ?? '—',
          t.assigned_driver_name ?? '—',
          t.assigned_vehicle_plate ?? '—',
          t.is_override ? 'Yes' : 'No',
          t.override_reason ?? (t.is_override ? '—' : 'Matched Best-Fit'),
        ])
      )
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate and export operational reports">
        <button type="button" className="btn-dx-primary" onClick={() => setShowExportSummary(true)} disabled={loading || exportSummary.rows === 0}>
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      {/* Tab selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {TABS.map(({ key, label, Icon, desc }) => (
          <button key={key} type="button"
            className={`dx-report-tab${tab === key ? ' dx-report-tab--active' : ''}`}
            onClick={() => { setTab(key); setPage(1) }}
          >
            <span className="dx-report-tab-icon"><Icon size={20} /></span>
            <div className="dx-report-tab-copy"><strong>{label}</strong><span>{desc}</span></div>
          </button>
        ))}
      </div>

      <div className="dx-panel">
        {tab === 'deliveries' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
              Filter:
              <select value={statusFilter} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); loadDeliveries(1, e.target.value) }}>
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="assigned">Assigned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{meta.total} records</span>
          </div>
        )}

        {tab === 'deliveries' ? (
          <>
            <DataTable headers={['#', 'Client', 'Driver', 'Vehicle', 'Status', 'Assigned', 'Completed']} loading={loading}
              empty={<EmptyState icon={FileText} title="No deliveries found" />}
            >
              {deliveries.length > 0 && deliveries.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--muted)' }}>#{d.id}</td>
                  <td style={{ fontWeight: 600 }}>{buildDisplayName(d.job_order) || '—'}</td>
                  <td>{d.driver?.user?.name ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{d.vehicle?.plate_no ?? '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {formatEventAt({ assigned_event_at: d.assigned_event_at, assigned_at: d.assigned_at }) ?? '—'}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {formatEventAt({ completed_event_at: d.completed_event_at, completed_at: d.completed_at }) ?? '—'}
                  </td>
                </tr>
              ))}
            </DataTable>
            {meta.last_page > 1 && (
              <div className="dx-pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} / {meta.last_page}</span>
                <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        ) : tab === 'driver_perf' ? (
          <DataTable headers={['Driver', 'Total Jobs', 'Completed', 'On-Time Rate', 'Availability']} loading={loading}
            empty={<EmptyState icon={Users} title="No driver data" />}
          >
            {(analytics?.drivers ?? []).map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.total}</td>
                <td>{d.completed}</td>
                <td>
                  {d.on_time_pct != null
                    ? <span style={{ fontWeight: 700, color: d.on_time_pct >= 90 ? 'var(--color-success)' : d.on_time_pct >= 75 ? 'var(--color-warning)' : 'var(--color-error)' }}>{d.on_time_pct}%</span>
                    : '—'}
                </td>
                <td><StatusBadge status={d.availability} /></td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginBottom: 16 }}>{auditMeta.total} assignment decisions recorded</p>
            <DataTable
              headers={['When', 'Dispatcher', 'Job', 'Best-Fit', 'Assigned', 'Override Reason']}
              loading={loading}
              empty={<EmptyState icon={ClipboardList} title="No assignment audits" message="Assignment decisions will appear here as dispatchers confirm assignments." />}
            >
              {auditTrails.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.dispatcher_name ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    {t.job_order_id ? formatJobPublicId(t.job_order_id) : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>
                    {t.recommended_driver_name
                      ? `${t.recommended_driver_name}${t.recommended_vehicle_plate ? ` · ${t.recommended_vehicle_plate}` : ''}`
                      : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>
                    <strong>{t.assigned_driver_name}</strong>
                    {t.assigned_vehicle_plate ? ` · ${t.assigned_vehicle_plate}` : ''}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--muted)', maxWidth: 260 }}>
                    {t.override_reason ?? (t.is_override ? '—' : 'Matched Best-Fit')}
                  </td>
                </tr>
              ))}
            </DataTable>
            {auditMeta.last_page > 1 && (
              <div className="dx-pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} / {auditMeta.last_page}</span>
                <button disabled={page >= auditMeta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      <ExportConfirmModal
        open={showExportSummary}
        onClose={() => setShowExportSummary(false)}
        onConfirm={handleConfirmExport}
        reportName={exportSummary.report}
        dateRange={exportSummary.dateRange}
        filters={exportSummary.filters}
        rows={exportSummary.rows}
        total={exportSummary.total}
        confirmLabel="Download CSV"
      />
    </>
  )
}

export default ReportsPage
