import { useEffect, useState } from 'react'
import { fetchVehicles } from '../../api/admin'

function VehicleManagementPage() {
  const [vehicles, setVehicles] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const response = await fetchVehicles(1)
        setVehicles(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadVehicles()
  }, [])

  return (
    <section className="page">
      <header className="page-header">
        <h1>Vehicle Management</h1>
        <p>Track fleet availability, capacity, and maintenance status.</p>
        {error && <p className="error">{error}</p>}
      </header>
      <div className="card">
        <h3>Fleet Inventory</h3>
        <div className="table">
          <div className="table-row table-head">
            <span>Plate</span>
            <span>Type</span>
            <span>Capacity</span>
            <span>Status</span>
          </div>
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="table-row">
              <span>{vehicle.plate_no}</span>
              <span>{vehicle.type}</span>
              <span>{vehicle.capacity ?? 'n/a'}</span>
              <span className="pill">{vehicle.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default VehicleManagementPage
