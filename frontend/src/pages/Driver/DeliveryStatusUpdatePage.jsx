import { useState } from 'react'
import { postStatusUpdate } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import { enqueue, getQueue } from '../../utils/offlineQueue'

function DeliveryStatusUpdatePage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [queueCount, setQueueCount] = useState(getQueue().length)
  const isOnline = useOnlineStatus()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    const formData = new FormData(event.target)
    const payload = {
      assignment_id: Number(formData.get('assignment_id')),
      status: formData.get('status'),
      notes: formData.get('notes'),
      latitude: formData.get('latitude') ? Number(formData.get('latitude')) : undefined,
      longitude: formData.get('longitude') ? Number(formData.get('longitude')) : undefined,
    }

    if (!isOnline) {
      enqueue({ type: 'status', payload })
      setQueueCount(getQueue().length)
      setMessage('Status update queued for sync.')
      return
    }

    try {
      await postStatusUpdate(payload)
      setMessage('Status updated successfully.')
      event.target.reset()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Status Update</h1>
        <p>Log milestones and share live progress with dispatch.</p>
        <p className="muted">Queued updates: {queueCount}</p>
      </header>
      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Assignment ID
          <input name="assignment_id" type="number" placeholder="Assignment ID" required />
        </label>
        <label>
          Status
          <select name="status" required>
            <option value="">Select status</option>
            <option value="assigned">Assigned</option>
            <option value="en_route">En Route</option>
            <option value="arrived">Arrived</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <div className="form-grid" style={{ gap: 12 }}>
          <label>
            GPS Latitude (optional)
            <input name="latitude" type="number" step="0.000001" placeholder="14.5995" />
          </label>
          <label>
            GPS Longitude (optional)
            <input name="longitude" type="number" step="0.000001" placeholder="120.9842" />
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows="3" placeholder="Optional notes" />
        </label>
        {message && <p className="banner">{message}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">Submit Update</button>
      </form>
    </section>
  )
}

export default DeliveryStatusUpdatePage
