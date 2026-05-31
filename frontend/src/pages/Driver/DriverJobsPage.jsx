import { useEffect, useState } from 'react'
import DriverJobCard from '../../components/driver/DriverJobCard'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import { fetchDriverAssignments } from '../../api/driver'
import { Briefcase } from 'lucide-react'

function DriverJobsPage() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    fetchDriverAssignments(1)
      .then((res) => setAssignments(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = assignments.filter((a) => {
    if (filter === 'active') return !['completed', 'cancelled'].includes(a.status)
    if (filter === 'completed') return a.status === 'completed'
    return true
  })

  return (
    <>
      <DriverOfflineBar />
      <p className="da-section-head" style={{ marginTop: 0 }}>Your assigned deliveries</p>

      <div className="da-tabs">
        {[
          { id: 'active', label: 'Active' },
          { id: 'completed', label: 'Completed' },
          { id: 'all', label: 'All' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`da-tab${filter === id ? ' da-tab--active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="da-alert da-alert--error">{error}</p>}

      {loading && (
        <>
          <div className="da-skeleton" />
          <div className="da-skeleton" />
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div className="da-empty">
          <Briefcase size={32} />
          <p style={{ fontWeight: 700, margin: '8px 0 0' }}>No jobs found</p>
          <p style={{ fontSize: '0.875rem', margin: '4px 0 0' }}>
            {filter === 'active' ? 'You have no active deliveries.' : 'Nothing for this filter.'}
          </p>
        </div>
      )}

      {!loading && filtered.map((a) => (
        <DriverJobCard key={a.id} assignment={a} />
      ))}
    </>
  )
}

export default DriverJobsPage
