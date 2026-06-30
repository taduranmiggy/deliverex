import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteCompanyUser, fetchCompanyUsers,
} from '../../api/customerPortal'
import useAuth from '../../hooks/useAuth'
import useConfirmation from '../../hooks/useConfirmation'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { Users } from 'lucide-react'

function CustomerCompanyUsersPage() {
  const { user } = useAuth()
  const { paths } = useCustomerSurface()
  const isOwner = user?.company_role === 'owner'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const msg = 'New customer users are now provisioned by admins in User Management.'
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCompanyUsers()
      setRows(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isOwner) load() }, [isOwner, load])

  const removeUser = (row) => {
    requestConfirmation({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove ${row.user?.name}?`,
      detail: 'They will no longer have access to this company account.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCompanyUser(row.id)
          load()
        } catch (err) {
          setError(err.message)
          throw err
        }
      },
    })
  }

  if (!isOwner) {
    return (
      <CustomerPageShell className="pwa-page">
        <CustomerPageHeader title="Team" description="Only company owners can manage team members." />
        <p><Link to={paths.profile}>Back to account</Link></p>
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell className="pwa-page">
      <CustomerPageHeader
        eyebrow={user?.company_name}
        title="Team members"
        description="View and manage company membership."
      />

      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice error">{error}</p>}

      <section className="pwa-section">
        <h2 className="pwa-section__title"><Users size={18} /> Current members</h2>
        {loading ? <p>Loading…</p> : (
          <div className="pwa-form-card">
            {rows.map((row) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--stroke)' }}>
                <div>
                  <strong>{row.user?.name}</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{row.user?.email} · {row.role}</div>
                </div>
                {row.role !== 'owner' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-dx-secondary btn-sm" onClick={() => removeUser(row)}>Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p><Link to={paths.profile}>Back to account</Link></p>
      {confirmationModal}
    </CustomerPageShell>
  )
}

export default CustomerCompanyUsersPage
