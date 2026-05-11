import { useEffect, useState } from 'react'
import { fetchDrivers, fetchVehicles } from '../../api/admin'
import {
  demoLicenseExpiry,
  demoPhoneIntl,
  formatLastMaintenanceIso,
  vehicleFleetBadge,
} from '../../utils/vehicleStatusUi'

function AdminMasterDataPage() {
  const [tab, setTab] = useState('vehicles')
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vehicleRes, driverRes] = await Promise.all([
          fetchVehicles(1),
          fetchDrivers(1),
        ])
        setVehicles(vehicleRes.data || [])
        setDrivers(driverRes.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadData()
  }, [])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Master Data</h1>
          <p>Manage vehicles and drivers</p>
        </div>
        <button className="btn-dx-primary" type="button">
          {tab === 'vehicles' ? '+ Add Vehicle' : '+ Add Driver'}
        </button>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ padding: '20px 0 0' }}>
        <div className="dx-tabs-underline" style={{ padding: '0 20px' }}>
          <button
            type="button"
            className={tab === 'vehicles' ? 'dx-tabs-underline--active' : ''}
            onClick={() => setTab('vehicles')}
          >
            Vehicles
          </button>
          <button
            type="button"
            className={tab === 'drivers' ? 'dx-tabs-underline--active' : ''}
            onClick={() => setTab('drivers')}
          >
            Drivers
          </button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {tab === 'vehicles' ? (
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Plate Number</th>
                    <th>Make / Model</th>
                    <th>Capacity (label)</th>
                    <th>Max weight (kg)</th>
                    <th>Max volume (m³)</th>
                    <th>Last Maintenance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      </td>
                    </tr>
                  )}
                  {vehicles.map((vehicle) => {
                    const vBadge = vehicleFleetBadge(vehicle)
                    return (
                      <tr key={vehicle.id}>
                        <td>{vehicle.plate_no}</td>
                        <td>{vehicle.type}</td>
                        <td>{vehicle.capacity ?? '—'}</td>
                        <td>{vehicle.max_weight_kg ?? '—'}</td>
                        <td>{vehicle.max_volume_m3 ?? '—'}</td>
                        <td>{formatLastMaintenanceIso(vehicle.updated_at)}</td>
                        <td>
                          <span className={vBadge.className}>{vBadge.label}</span>
                        </td>
                        <td>
                          <button type="button" className="dx-table-link">
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>License Number</th>
                    <th>License Expiry</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No drivers found.
                      </td>
                    </tr>
                  )}
                  {drivers.map((driver) => {
                    const isActive =
                      driver.user?.status !== 'inactive' && driver.availability !== 'inactive'
                    return (
                      <tr key={driver.id}>
                        <td>{driver.user?.name ?? '—'}</td>
                        <td>{driver.license_no}</td>
                        <td>{demoLicenseExpiry(driver.id)}</td>
                        <td>{demoPhoneIntl(driver.user_id ?? driver.id)}</td>
                        <td>
                          <span
                            className={`badge-dx ${isActive ? 'badge-dx--user-active' : 'badge-dx--user-inactive'}`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="dx-table-link">
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default AdminMasterDataPage
