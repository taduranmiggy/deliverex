import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchDriverAssignment } from '../../api/driver'

function DriverJobDetailsPage() {
  const { id } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAssignment = async () => {
      try {
        const response = await fetchDriverAssignment(id)
        setAssignment(response)
      } catch (err) {
        setError(err.message)
      }
    }

    if (id) {
      loadAssignment()
    }
  }, [id])

  return (
    <section className="page">
      <header className="page-header">
        <h1>Job Details</h1>
        <p>Review delivery instructions, ETA, and status timeline.</p>
        {error && <p className="error">{error}</p>}
      </header>
      <div className="card">
        <h3>Job Overview</h3>
        {assignment ? (
          <div className="stack">
            <p><strong>Assignment:</strong> {assignment.id}</p>
            <p><strong>Status:</strong> {assignment.status}</p>
            <p><strong>Pickup:</strong> {assignment.job_order?.pickup_location}</p>
            <p><strong>Drop-off:</strong> {assignment.job_order?.dropoff_location}</p>
          </div>
        ) : (
          <p>Loading assignment details...</p>
        )}
      </div>
    </section>
  )
}

export default DriverJobDetailsPage
