import { useEffect, useState } from 'react'
import { fetchAnalytics } from '../../api/manager'
import { IconPackage, IconStar, IconTrendingUp } from '../../components/DxIcons'

const DRIVER_ROWS = [
  { name: 'Miguel Reyes', deliveries: 18, ot: '95%', rev: '₱245,000' },
  { name: 'Juan Dela Cruz', deliveries: 16, ot: '93%', rev: '₱218,500' },
  { name: 'Carlo Mendoza', deliveries: 12, ot: '90%', rev: '₱186,400' },
]

const MATERIAL_ROWS = [
  { mat: 'Gravel', orders: 18, vol: '180 tons', rev: '₱245,000' },
  { mat: 'Sand', orders: 14, vol: '98 tons', rev: '₱168,000' },
  { mat: 'Cement', orders: 9, vol: '42 tons', rev: '₱124,500' },
]

function AnalyticsPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        await fetchAnalytics()
      } catch (err) {
        setError(err.message)
      }
    }

    loadAnalytics()
  }, [])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Analytics</h1>
          <p>Deep insights into operations</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel">
        <div className="inline" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', width: '100%' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Date From</span>
            <input type="date" defaultValue="2026-02-01" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Date To</span>
            <input type="date" defaultValue="2026-02-28" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Client</span>
            <select style={{ minWidth: 160 }}>
              <option>All clients</option>
            </select>
          </label>
          <button type="button" className="btn-dx-primary" style={{ marginLeft: 'auto' }}>
            Apply Filters
          </button>
        </div>
      </div>

      <div className="dx-stat-row" style={{ marginTop: 16 }}>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconStar />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Top Driver</div>
            <div className="dx-stat-card__value" style={{ fontSize: '1rem' }}>
              Miguel Reyes
            </div>
            <div className="dx-kpi-delta dx-kpi-delta--up">95% on-time rate</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconPackage />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Most Requested Material</div>
            <div className="dx-stat-card__value">Gravel</div>
            <div className="dx-kpi-delta dx-kpi-delta--up">35% of total orders</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconTrendingUp />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Growth Trend</div>
            <div className="dx-stat-card__value">+12.5%</div>
            <div className="dx-kpi-delta dx-kpi-delta--up">vs. last month</div>
          </div>
        </div>
      </div>

      <div className="dx-panel" style={{ marginTop: 16 }}>
        <h3 className="dx-panel-title">Driver Performance</h3>
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Total Deliveries</th>
                <th>On-Time Rate</th>
                <th>Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              {DRIVER_ROWS.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.deliveries}</td>
                  <td>{row.ot}</td>
                  <td>{row.rev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dx-panel" style={{ marginTop: 16 }}>
        <h3 className="dx-panel-title">Material Analysis</h3>
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Orders</th>
                <th>Total Volume</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {MATERIAL_ROWS.map((row) => (
                <tr key={row.mat}>
                  <td>{row.mat}</td>
                  <td>{row.orders}</td>
                  <td>{row.vol}</td>
                  <td>{row.rev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default AnalyticsPage
