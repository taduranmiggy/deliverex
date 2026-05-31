import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import LiveFleetMap from '../../components/LiveFleetMap'
import { PageHeader, StatusBadge } from '../../components/ui'
import { ExternalLink, MapPin, RefreshCw } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'

function fetchActiveDeliveries() {
  return apiRequest('/manager/active-deliveries')
}

function ManagerFleetTrackingPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    setError('')
    try {
      const res = await fetchActiveDeliveries()
      setRows(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const markers = useMemo(
    () => rows
      .filter((r) => r.gps)
      .map((r) => ({
        id: r.id,
        lat: r.gps.lat,
        lng: r.gps.lng,
        label: r.driver ?? 'Driver',
        sublabel: r.job_order ? formatJobPublicId(r.job_order.id) : `#${r.id}`,
      })),
    [rows],
  )

  return (
    <>
      <PageHeader title="Fleet Tracking" subtitle="Latest driver updates and last reported status">
        <button type="button" className="btn-dx-secondary btn-sm" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.7s linear infinite' } : {}} />
          Refresh
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ marginBottom: 20 }}>
        <h3 className="dx-panel-title">Last Known Locations</h3>
        <LiveFleetMap markers={markers} />
      </div>

      <div className="dx-panel">
        <h3 className="dx-panel-title">Active deliveries ({rows.length})</h3>
        {rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No active deliveries.</p>
        ) : (
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr><th>Job</th><th>Driver</th><th>Vehicle</th><th>Status</th><th>GPS</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.job_order ? formatJobPublicId(r.job_order.id) : `#${r.id}`}</td>
                    <td>{r.driver ?? '—'}</td>
                    <td>{r.vehicle ?? '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {r.gps ? `${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)}` : '—'}
                    </td>
                    <td>
                      {r.gps && (
                        <a href={`https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}`} target="_blank" rel="noopener noreferrer" className="btn-dx-secondary btn-sm">
                          <ExternalLink size={12} /> Maps
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

export default ManagerFleetTrackingPage
