import { useEffect, useState } from 'react'
import { fetchAssignmentAuditTrails } from '../api/assignmentAudit'
import { DataTable, EmptyState, SectionCard } from './ui'
import { ClipboardList } from 'lucide-react'
import { formatJobPublicId } from '../utils/formatPhp'

function AssignmentAuditSection({ title = 'Assignment Audit Trail', limit = 8, overridesOnly = false, hideWhenEmpty = false }) {
  const [trails, setTrails] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = { recent: 1, per_page: limit }
    if (overridesOnly) params.overrides_only = 1

    fetchAssignmentAuditTrails(params)
      .then((res) => setTrails((res.data || []).slice(0, limit)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [limit, overridesOnly])

  if (error) {
    return <p className="notice error">{error}</p>
  }

  if (hideWhenEmpty && !loading && trails.length === 0) {
    return null
  }

  return (
    <SectionCard title={title} action={<ClipboardList size={16} color="var(--color-primary)" />}>
      <DataTable
        headers={['When', 'Dispatcher', 'Job', 'Best-Fit', 'Assigned', 'Override Reason']}
        loading={loading}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No assignment audits"
            message="Assignment decisions from the last 30 days will appear here."
          />
        }
      >
        {trails.map((t) => (
          <tr key={t.id}>
            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
              {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
            </td>
            <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.dispatcher_name ?? '—'}</td>
            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
              {t.job_order_id ? formatJobPublicId(t.job_order_id) : '—'}
            </td>
            <td style={{ fontSize: '0.8125rem' }}>
              {t.recommended_driver_name
                ? (
                  <>
                    <strong>{t.recommended_driver_name}</strong>
                    {t.recommended_vehicle_plate ? ` · ${t.recommended_vehicle_plate}` : ''}
                  </>
                )
                : '—'}
            </td>
            <td style={{ fontSize: '0.8125rem' }}>
              <strong>{t.assigned_driver_name}</strong>
              {t.assigned_vehicle_plate ? ` · ${t.assigned_vehicle_plate}` : ''}
              {t.is_override && (
                <span className="badge-dx badge-dx--reviewing" style={{ marginLeft: 6, fontSize: '0.65rem' }}>
                  Override
                </span>
              )}
            </td>
            <td style={{ fontSize: '0.8125rem', color: 'var(--muted)', maxWidth: 220 }}>
              {t.override_reason
                ? (t.override_reason.length > 70 ? `${t.override_reason.slice(0, 70)}…` : t.override_reason)
                : t.is_override ? '—' : 'Matched Best-Fit'}
            </td>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  )
}

export default AssignmentAuditSection
