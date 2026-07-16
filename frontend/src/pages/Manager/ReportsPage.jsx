import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAssignmentAuditTrails } from '../../api/assignmentAudit'
import { exportManagerReport, fetchAnalytics, fetchReports } from '../../api/manager'
import ExportConfirmModal from '../../components/ExportConfirmModal'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../../components/ui'
import { downloadBlob, printReportPanel } from '../../utils/export/download'
import { ClipboardList, Download, FileText, Printer, Users } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatEventAt } from '../../utils/deliveryTimestamps'

const STATUS_LABELS = {
  completed: 'Completed',
  in_progress: 'In Progress',
  assigned: 'Assigned',
  cancelled: 'Cancelled',
}

const EXPORT_TYPES = {
  deliveries: 'deliveries',
  driver_perf: 'driver_performance',
  assignment_audit: 'assignment_audit',
}

const TABS = [
  { key: 'deliveries', label: 'Deliveries', Icon: FileText, desc: 'Complete delivery history' },
  { key: 'driver_perf', label: 'Driver Performance', Icon: Users, desc: 'Driver efficiency metrics' },
  { key: 'assignment_audit', label: 'Assignment Audit', Icon: ClipboardList, desc: 'Best-Fit vs actual assignments' },
]

function ReportsPage() {
  const [tab, setTab] = useState('deliveries')
  const [deliveries, setDeliveries] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [auditTrails, setAuditTrails] = useState([])
  const [auditMeta, setAuditMeta] = useState({ last_page: 1, total: 0 })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ last_page: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dateField, setDateField] = useState('assigned_at')
  const [sortDir, setSortDir] = useState('desc')
  const [exportFormat, setExportFormat] = useState('csv')
  const [showExportSummary, setShowExportSummary] = useState(false)

  const deliveryFilters = useMemo(() => ({
    page,
    per_page: 6,
    status: statusFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    date_field: dateField,
    sort: dateField,
    sort_dir: sortDir,
  }), [page, statusFilter, fromDate, toDate, dateField, sortDir])

  const loadDeliveries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchReports(deliveryFilters)
      setDeliveries(res.data || [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [deliveryFilters])

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      setAnalytics(await fetchAnalytics({
        drivers_page: 1,
        drivers_per_page: 6,
        from: fromDate || undefined,
        to: toDate || undefined,
      }))
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  const loadAuditTrails = useCallback(async (p = 1) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAssignmentAuditTrails({
        page: p,
        per_page: 6,
        from: fromDate || undefined,
        to: toDate || undefined,
        sort_dir: sortDir,
      })
      setAuditTrails(res.data || [])
      setAuditMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, sortDir])

  useEffect(() => {
    if (tab === 'deliveries') loadDeliveries()
    else if (tab === 'driver_perf') loadAnalytics()
    else loadAuditTrails(page)
  }, [tab, page, loadDeliveries, loadAnalytics, loadAuditTrails])

  const filterSummary = useMemo(() => {
    const parts = []
    if (statusFilter) parts.push(STATUS_LABELS[statusFilter] ?? statusFilter)
    if (fromDate) parts.push(`From ${fromDate}`)
    if (toDate) parts.push(`To ${toDate}`)
    if (dateField && tab === 'deliveries') parts.push(`Date: ${dateField.replace('_', ' ')}`)
    return parts.length ? parts.join(' · ') : 'All records'
  }, [statusFilter, fromDate, toDate, dateField, tab])

  const exportSummary = useMemo(() => {
    if (tab === 'deliveries') {
      return {
        report: 'Deliveries',
        filters: filterSummary,
        rows: meta.total,
        total: meta.total,
        dateRange: fromDate && toDate ? `${fromDate} – ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Until ${toDate}` : 'All records',
      }
    }
    if (tab === 'driver_perf') {
      const rows = analytics?.drivers ?? []
      return {
        report: 'Driver Performance',
        filters: filterSummary,
        rows: analytics?.drivers_pagination?.total ?? rows.length,
        total: analytics?.drivers_pagination?.total ?? rows.length,
        dateRange: analytics?.filters?.from && analytics?.filters?.to
          ? `${analytics.filters.from} – ${analytics.filters.to}`
          : filterSummary,
      }
    }
    return {
      report: 'Assignment Audit',
      filters: filterSummary,
      rows: auditMeta.total,
      total: auditMeta.total,
      dateRange: fromDate && toDate ? `${fromDate} – ${toDate}` : 'Last 90 days (default)',
    }
  }, [tab, filterSummary, meta.total, analytics, auditMeta.total, fromDate, toDate])

  const buildExportFilters = () => {
    if (tab === 'deliveries') {
      return {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        date_field: dateField,
        sort: dateField,
        sort_dir: sortDir,
      }
    }
    if (tab === 'driver_perf') {
      return {
        from: fromDate || analytics?.filters?.from,
        to: toDate || analytics?.filters?.to,
        sort: 'reliability_score',
        sort_dir: sortDir,
      }
    }
    return {
      from: fromDate || undefined,
      to: toDate || undefined,
      sort_dir: sortDir,
    }
  }

  const handleConfirmExport = async () => {
    setExporting(true)
    try {
      const { blob, filename } = await exportManagerReport(
        EXPORT_TYPES[tab],
        exportFormat,
        buildExportFilters(),
      )
      downloadBlob(blob, filename)
      setShowExportSummary(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const applyFilters = () => {
    setPage(1)
    if (tab === 'deliveries') loadDeliveries()
    else if (tab === 'driver_perf') loadAnalytics()
    else loadAuditTrails(1)
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate and export operational reports">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-dx-secondary" onClick={() => printReportPanel()} disabled={loading}>
            <Printer size={15} /> Print
          </button>
          <button type="button" className="btn-dx-primary" onClick={() => setShowExportSummary(true)} disabled={loading || exportSummary.total === 0}>
            <Download size={15} /> Export
          </button>
        </div>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

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

      <div className="dx-panel dx-report-print-area">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {tab === 'deliveries' && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
              Status
              <select value={statusFilter} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }}
                onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="assigned">Assigned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          )}
          {tab === 'deliveries' && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
              Date field
              <select value={dateField} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }}
                onChange={(e) => setDateField(e.target.value)}>
                <option value="assigned_at">Assigned</option>
                <option value="started_at">Started</option>
                <option value="completed_at">Completed</option>
                <option value="created_at">Created</option>
              </select>
            </label>
          )}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit' }} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit' }} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
            Sort
            <select value={sortDir} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }}
              onChange={(e) => setSortDir(e.target.value)}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <button type="button" className="btn-dx-secondary" onClick={applyFilters}>Apply</button>
          <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
            {tab === 'deliveries' ? meta.total : tab === 'assignment_audit' ? auditMeta.total : (analytics?.drivers_pagination?.total ?? 0)} records
          </span>
        </div>

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
          <DataTable headers={['Driver', 'Score', 'Total Jobs', 'Completed', 'On-Time Rate', 'Availability']} loading={loading}
            empty={<EmptyState icon={Users} title="No driver data" />}
          >
            {(analytics?.drivers ?? []).map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.reliability_score ?? '—'}</td>
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
        confirming={exporting}
        formatValue={exportFormat}
        onFormatChange={setExportFormat}
        infoNotice="Server export includes all matching records (up to 10,000 rows) with Deliverex report branding."
        confirmLabel={`Download ${exportFormat.toUpperCase()}`}
      />
    </>
  )
}

export default ReportsPage
