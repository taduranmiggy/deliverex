import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { convertInquiry, deleteInquiry, fetchInquiries, markInquiryRead } from '../../api/admin'

const STATUS_BADGE = {
  new:       'badge-dx badge-dx--pending',
  read:      'badge-dx badge-dx--muted',
  converted: 'badge-dx badge-dx--completed',
}

function InquiriesPage() {
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState([])
  const [filter, setFilter]       = useState('all')
  const [selected, setSelected]   = useState(null)
  const [error, setError]         = useState('')
  const [msg, setMsg]             = useState('')
  const [page, setPage]           = useState(1)
  const [meta, setMeta]           = useState({ last_page: 1 })

  const load = useCallback(async (p = 1, f = 'all') => {
    setError('')
    try {
      const res = await fetchInquiries(p, f)
      setInquiries(res.data || [])
      setMeta({ last_page: res.last_page ?? 1 })
      if (!selected && res.data?.length > 0) setSelected(res.data[0])
    } catch (err) { setError(err.message) }
  }, [selected])

  useEffect(() => { load(page, filter) }, [page, filter]) // eslint-disable-line

  const handleRead = async (id) => {
    try { await markInquiryRead(id); load(page, filter) } catch (err) { setError(err.message) }
  }

  const handleConvert = async (id) => {
    if (!window.confirm('Convert this inquiry into a Job Order?')) return
    try {
      const res = await convertInquiry(id)
      setMsg(`Job Order created (Tracking: ${res.job_order?.tracking_code}). Redirecting to Job Orders…`)
      load(page, filter)
      setTimeout(() => { setMsg(''); navigate('/dispatcher/job-orders') }, 2500)
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inquiry?')) return
    try { await deleteInquiry(id); setSelected(null); load(page, filter) }
    catch (err) { setError(err.message) }
  }

  const unreadCount = inquiries.filter((i) => i.status === 'new').length

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Inquiries</h1>
          <p>Customer contact requests and delivery inquiries
            {unreadCount > 0 && <span className="badge-dx badge-dx--pending" style={{ marginLeft: 8 }}>{unreadCount} new</span>}
          </p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'new', 'read', 'converted'].map((f) => (
          <button key={f} type="button"
            className={`dx-ocr-tab${filter === f ? ' dx-ocr-tab--active' : ''}`}
            onClick={() => { setFilter(f); setPage(1) }}
            style={{ textTransform: 'capitalize' }}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 400px' }}>
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead><tr>
                <th>Name</th><th>Email</th><th>Route</th><th>Status</th><th>Received</th>
              </tr></thead>
              <tbody>
                {inquiries.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>No inquiries.</td></tr>
                )}
                {inquiries.map((inq) => (
                  <tr key={inq.id} role="button" tabIndex={0} style={{ cursor: 'pointer',
                    outline: selected?.id === inq.id ? '2px solid var(--primary)' : 'none' }}
                    onClick={() => { setSelected(inq); handleRead(inq.id) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setSelected(inq); handleRead(inq.id) } }}
                  >
                    <td><strong>{inq.name}</strong></td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{inq.email}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {[inq.pickup_location, inq.dropoff_location].filter(Boolean).join(' → ') || '—'}
                    </td>
                    <td><span className={STATUS_BADGE[inq.status] ?? 'badge-dx badge-dx--muted'} style={{ textTransform: 'capitalize' }}>{inq.status}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {inq.created_at ? new Date(inq.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta.last_page > 1 && (
            <div className="dx-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span>Page {page} / {meta.last_page}</span>
              <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>

        <div className="dx-detail-panel" style={{ marginBottom: 0 }}>
          <div className="dx-detail-panel__top">
            <h2 style={{ margin: 0, fontSize: '1rem' }}>
              {selected ? selected.name : 'Inquiry detail'}
            </h2>
          </div>
          <div className="dx-detail-panel__body">
            {!selected ? (
              <p style={{ color: 'var(--muted)', margin: 0 }}>Select an inquiry to view details.</p>
            ) : (
              <>
                <div className="dx-kv"><span>Name</span><strong>{selected.name}</strong></div>
                <div className="dx-kv"><span>Email</span><strong>{selected.email}</strong></div>
                <div className="dx-kv"><span>Phone</span><strong>{selected.phone ?? '—'}</strong></div>
                <div className="dx-kv"><span>Pickup</span><strong>{selected.pickup_location ?? '—'}</strong></div>
                <div className="dx-kv"><span>Drop-off</span><strong>{selected.dropoff_location ?? '—'}</strong></div>
                <div style={{ marginTop: 12, marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)' }}>Message</div>
                <div style={{ background: 'var(--surface-soft, #f8f9fa)', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {selected.message}
                </div>
                <div className="dx-kv" style={{ marginTop: 12 }}>
                  <span>Status</span>
                  <span className={STATUS_BADGE[selected.status] ?? 'badge-dx badge-dx--muted'} style={{ textTransform: 'capitalize' }}>{selected.status}</span>
                </div>
                {selected.job_order_id && (
                  <div className="dx-kv"><span>Job Order</span><strong>#{selected.job_order_id}</strong></div>
                )}
                {selected.status !== 'converted' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button type="button" className="btn-dx-primary"
                      style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                      onClick={() => handleConvert(selected.id)}>
                      Convert to Job Order
                    </button>
                    <button type="button" className="btn-dx-secondary"
                      style={{ fontSize: '0.8rem', padding: '7px 14px', color: 'var(--error, #dc2626)' }}
                      onClick={() => handleDelete(selected.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default InquiriesPage
