import { useEffect, useState } from 'react'
import { fetchReports } from '../../api/manager'
import { formatDemoPhp, formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'

function ManagerDeliveryHistoryPage() {
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetchReports(1)
        setHistory(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadHistory()
  }, [])

  const rendered = history.length ? history : null

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Delivery History</h1>
          <p>Complete history of all deliveries</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}
      <div className="dx-panel" style={{ padding: 0 }}>
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rendered && rendered.map((item) => {
                const jid = item.job_order_id ?? item.job_order?.id
                const done = ['completed'].includes(String(item.status || '').toLowerCase())
                return (
                  <tr key={item.id}>
                    <td>{jid ? formatJobPublicId(jid, 2024) : formatJobPublicId(item.id, 2024)}</td>
                    <td>{item.job_order?.customer_name ?? '—'}</td>
                    <td>{item.driver?.user?.name ?? '—'}</td>
                    <td>{item.vehicle?.plate_no ?? '—'}</td>
                    <td>
                      <span className={jobStatusBadgeClass(item.status)}>
                        {formatJobStatus(item.status)}
                      </span>
                    </td>
                    <td>
                      {done && item.updated_at
                        ? new Date(item.updated_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td>{formatDemoPhp(jid ?? item.id)}</td>
                  </tr>
                )
              })}
              {!rendered && MOCK_ROWS.map((row) => (
                <tr key={row.jobId}>
                  <td>{row.jobId}</td>
                  <td>{row.client}</td>
                  <td>{row.driver}</td>
                  <td>{row.vehicle}</td>
                  <td>
                    <span className={jobStatusBadgeClass(row.statusSlug)}>{row.statusLabel}</span>
                  </td>
                  <td>{row.completed}</td>
                  <td>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

const MOCK_ROWS = [
  {
    jobId: 'J-2024-001',
    client: 'Maria Santos',
    driver: 'Juan Dela Cruz',
    vehicle: 'ABC-1234',
    statusSlug: 'in_progress',
    statusLabel: 'En Route',
    completed: '—',
    amount: '₱12,450.00',
  },
  {
    jobId: 'J-2024-002',
    client: 'Jose Ramirez',
    driver: '—',
    vehicle: '—',
    statusSlug: 'pending',
    statusLabel: 'Pending',
    completed: '—',
    amount: '₱8,500.00',
  },
  {
    jobId: 'J-2024-003',
    client: 'Ana Gomez',
    driver: 'Miguel Reyes',
    vehicle: 'XYZ-5678',
    statusSlug: 'completed',
    statusLabel: 'Completed',
    completed: 'Feb 20, 10:45 AM',
    amount: '₱21,750.00',
  },
]

export default ManagerDeliveryHistoryPage
