import { useMemo, useState } from 'react'

const DEMO_LOGS = [
  {
    id: 1,
    timestamp: 'Feb 26, 2024, 02:30 PM',
    user: 'Maria Santos',
    action: 'Approved OCR Document',
    module: 'OCR Validation',
    details: 'Document DOC-001 linked to Job J-2024-001',
  },
  {
    id: 2,
    timestamp: 'Feb 26, 2024, 01:15 PM',
    user: 'Juan Dela Cruz',
    action: 'Assigned Job',
    module: 'Dispatch',
    details: 'Job J-2024-004 assigned to Juan Dela Cruz',
  },
  {
    id: 3,
    timestamp: 'Feb 26, 2024, 12:00 PM',
    user: 'Maria Santos',
    action: 'Created User',
    module: 'Users & Roles',
    details: 'User Ana Dizon created with dispatcher role',
  },
  {
    id: 4,
    timestamp: 'Feb 26, 2024, 11:30 AM',
    user: 'Jose Ramirez',
    action: 'Exported Report',
    module: 'Reports',
    details: 'Revenue report exported as PDF',
  },
  {
    id: 5,
    timestamp: 'Feb 26, 2024, 10:45 AM',
    user: 'Juan Dela Cruz',
    action: 'Updated Job Status',
    module: 'Job Orders',
    details: 'Job J-2024-003 marked as Completed',
  },
]

function AdminAuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState('All Modules')

  const visibleLogs = useMemo(() => {
    if (moduleFilter === 'All Modules') return DEMO_LOGS
    return DEMO_LOGS.filter((l) => l.module === moduleFilter)
  }, [moduleFilter])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Audit Logs</h1>
          <p>Complete history of system activities</p>
        </div>
        <div className="dx-export-btns">
          <button type="button">CSV</button>
          <button type="button">PDF</button>
        </div>
      </header>

      <div className="dx-audit-toolbar">
        <label htmlFor="audit-module-filter" className="sr-only">
          Filter by module
        </label>
        <select
          id="audit-module-filter"
          aria-label="Filter by module"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          style={{
            border: '1px solid var(--stroke)',
            borderRadius: 8,
            padding: '10px 12px',
            font: 'inherit',
            background: '#fff',
            minWidth: 180,
          }}
        >
          <option>All Modules</option>
          <option>OCR Validation</option>
          <option>Dispatch</option>
          <option>Users & Roles</option>
          <option>Reports</option>
          <option>Job Orders</option>
        </select>
      </div>

      <div className="dx-panel" style={{ padding: 0 }}>
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No entries for this module.
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.timestamp}</td>
                    <td>{log.user}</td>
                    <td>{log.action}</td>
                    <td>{log.module}</td>
                    <td>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default AdminAuditLogsPage
