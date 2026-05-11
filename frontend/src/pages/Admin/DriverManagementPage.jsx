import { useEffect, useState } from 'react'
import { fetchDrivers } from '../../api/admin'

function DriverManagementPage() {
  const [drivers, setDrivers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const response = await fetchDrivers(1)
        setDrivers(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadDrivers()
  }, [])

  return (
    <section className="page">
      <header className="page-header">
        <h1>Driver Management</h1>
        <p>Keep licenses, availability, and certifications up to date.</p>
        {error && <p className="error">{error}</p>}
      </header>
      <div className="card">
        <h3>Driver Roster</h3>
        <div className="table">
          <div className="table-row table-head three-col">
            <span>Name</span>
            <span>License</span>
            <span>Availability</span>
          </div>
          {drivers.map((driver) => (
            <div key={driver.id} className="table-row three-col">
              <span>{driver.user?.name ?? 'Unlinked'}</span>
              <span>{driver.license_no}</span>
              <span className="pill">{driver.availability}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DriverManagementPage
