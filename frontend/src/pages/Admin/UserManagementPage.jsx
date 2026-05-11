import { useEffect, useState } from 'react'
import { fetchUsers } from '../../api/admin'

function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetchUsers(1)
        setUsers(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadUsers()
  }, [])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Users &amp; Roles</h1>
          <p>Manage user accounts and permissions</p>
        </div>
        <button className="btn-dx-primary" type="button">
          + Add User
        </button>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel">
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((user) => {
                const active = user.status !== 'inactive'
                const roleLabel = user.role?.name ?? '—'
                return (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <a href="#role" className="dx-role-link" onClick={(e) => e.preventDefault()}>
                        {roleLabel}
                      </a>
                    </td>
                    <td>
                      <span
                        className={`badge-dx ${active ? 'badge-dx--user-active' : 'badge-dx--user-inactive'}`}
                      >
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="dx-text-actions">
                        <button type="button">Edit Role</button>
                        <button type="button">{active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default UserManagementPage
