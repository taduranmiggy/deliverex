import { useEffect, useState } from 'react'
import { fetchIssueReports } from '../api/issueReports'
import { DataTable, EmptyState, SectionCard } from './ui'
import { AlertTriangle, Camera } from 'lucide-react'
import { formatJobPublicId } from '../utils/formatPhp'

function IssueReportsSection({ title = 'Driver Issue Reports', limit = 8 }) {
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIssueReports({ recent: 1 })
      .then((res) => setReports((res.data || []).slice(0, limit)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [limit])

  if (error) {
    return <p className="notice error">{error}</p>
  }

  return (
    <SectionCard title={title} action={<AlertTriangle size={16} color="var(--color-warning)" />}>
      <DataTable
        headers={['When', 'Driver', 'Job', 'Category', 'Notes', 'Photo']}
        loading={loading}
        empty={<EmptyState icon={AlertTriangle} title="No issue reports" message="Driver issue reports from the last 30 days will appear here." />}
      >
        {reports.map((r) => (
          <tr key={r.id}>
            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
              {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
            </td>
            <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.driver_name ?? '—'}</td>
            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
              {r.job_order_id ? formatJobPublicId(r.job_order_id) : '—'}
            </td>
            <td>
              <span className="badge-dx badge-dx--reviewing" style={{ fontSize: '0.7rem' }}>
                {r.issue_type_label ?? r.issue_type}
              </span>
            </td>
            <td style={{ fontSize: '0.8125rem', color: 'var(--muted)', maxWidth: 200 }}>
              {r.notes ? (r.notes.length > 60 ? `${r.notes.slice(0, 60)}…` : r.notes) : '—'}
            </td>
            <td>
              {r.photo_url ? (
                <a href={r.photo_url} target="_blank" rel="noopener noreferrer" className="btn-dx-secondary btn-sm" style={{ display: 'inline-flex', gap: 4 }}>
                  <Camera size={12} /> View
                </a>
              ) : (
                <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>—</span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  )
}

export default IssueReportsSection
