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
          <input name="status" type="text" placeholder="in_progress, completed" required />
        </label>
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
