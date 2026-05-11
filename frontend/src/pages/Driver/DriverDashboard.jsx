import { useEffect, useState } from 'react'
import { fetchDriverAssignments, postTrackingUpdate } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import { enqueue, getQueue } from '../../utils/offlineQueue'
import { syncQueue } from '../../utils/syncQueue'

function DriverDashboard() {
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState('')
  const [queueCount, setQueueCount] = useState(getQueue().length)
  const [syncMessage, setSyncMessage] = useState('')
  const isOnline = useOnlineStatus()

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const response = await fetchDriverAssignments(1)
        setAssignments(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadAssignments()
  }, [])

  const handleSync = async () => {
    setSyncMessage('')
    if (!isOnline) {
      setSyncMessage('You are offline. Sync will resume when online.')
      return
    }
    const result = await syncQueue()
    setQueueCount(result.remaining)
    setSyncMessage(`Synced ${result.processed} updates.`)
  }

  const handleGpsPing = async () => {
    const payload = {
      assignment_id: assignments[0]?.id,
      latitude: 14.5995,
      longitude: 120.9842,
    }

    if (!payload.assignment_id) {
      setError('No assignment available for GPS ping.')
      return
    }

    if (!isOnline) {
      enqueue({ type: 'tracking', payload })
      setQueueCount(getQueue().length)
      setSyncMessage('GPS update queued for sync.')
      return
    }

    try {
      await postTrackingUpdate(payload)
      setSyncMessage('GPS update sent.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Driver Dashboard</h1>
        <p>Review assignments and keep deliveries on schedule.</p>
        {error && <p className="error">{error}</p>}
      </header>
      <div className="card">
        <h3>Connectivity</h3>
        <div className="status-row">
          <span className={`pill ${isOnline ? 'pill-online' : 'pill-offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <span>{queueCount} queued updates</span>
        </div>
        <div className="cta-row">
          <button type="button" className="primary" onClick={handleSync}>
            Sync Queue
          </button>
          <button type="button" className="ghost" onClick={handleGpsPing}>
            Send GPS Ping
          </button>
        </div>
        {syncMessage && <p className="banner">{syncMessage}</p>}
      </div>
      <div className="card">
        <h3>Assigned Jobs</h3>
        <div className="table">
          <div className="table-row table-head">
            <span>Assignment</span>
            <span>Status</span>
            <span>Pickup</span>
            <span>Drop-off</span>
          </div>
          {assignments.map((assignment) => (
            <div key={assignment.id} className="table-row">
              <span>{assignment.id}</span>
              <span className="pill">{assignment.status}</span>
              <span>{assignment.job_order?.pickup_location ?? 'n/a'}</span>
              <span>{assignment.job_order?.dropoff_location ?? 'n/a'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DriverDashboard
