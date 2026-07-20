import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { convertInquiry, deleteInquiry, fetchInquiries, markInquiryRead, replyToInquiry } from '../../api/admin'
import useConfirmation from '../../hooks/useConfirmation'
import { Loader2, Send } from 'lucide-react'

const STATUS_BADGE = {
  new:       'badge-dx badge-dx--pending',
  read:      'badge-dx badge-dx--muted',
  replied:   'badge-dx badge-dx--dispatched',
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
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying]   = useState(false)
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const load = useCallback(async (p = 1, f = 'all') => {
    setError('')
    try {
      const res = await fetchInquiries(p, f)
      setInquiries(res.data || [])
      setMeta({ last_page: res.last_page ?? 1 })
      setSelected((prev) => {
        if (!prev) return res.data?.[0] ?? null
        const refreshed = (res.data || []).find((row) => row.id === prev.id)
        return refreshed ?? prev
      })
    } catch (err) { setError(err.message) }
  }, [])

  useEffect(() => { load(page, filter) }, [page, filter, load])

  useEffect(() => {
    setReplyText('')
  }, [selected?.id])

  const handleRead = async (id) => {
    try {
      const updated = await markInquiryRead(id)
      setInquiries((prev) => prev.map((row) => (row.id === id ? { ...row, ...updated } : row)))
      setSelected((prev) => (prev?.id === id ? { ...prev, ...updated } : prev))
    } catch (err) { setError(err.message) }
  }

  const handleSelect = (inq) => {
    setSelected(inq)
    if (inq.status === 'new') handleRead(inq.id)
  }

  const handleReply = async () => {
    if (!selected) return
    const message = replyText.trim()
    if (message.length < 5) {
      setError('Reply must be at least 5 characters.')
      return
    }
    setReplying(true)
    setError('')
    setMsg('')
    try {
      const res = await replyToInquiry(selected.id, message)
      setMsg(res.message || `Reply sent to ${selected.email}.`)
      setReplyText('')
      if (res.inquiry) {
        setSelected(res.inquiry)
        setInquiries((prev) => prev.map((row) => (row.id === res.inquiry.id ? res.inquiry : row)))
      } else {
        await load(page, filter)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setReplying(false)
    }
  }

  const handleConvert = (id) => {
    requestConfirmation({
      title: 'Convert Inquiry',
      message: 'Convert this inquiry into a Job Order?',
      detail: 'A new job order will be created from this inquiry.',
      confirmLabel: 'Convert',
      variant: 'primary',
      onConfirm: async () => {
        try {
          const res = await convertInquiry(id)
          setMsg(`Job Order created (Tracking: ${res.job_order?.tracking_code}). Redirecting to Job Orders…`)
          load(page, filter)
          setTimeout(() => { setMsg(''); navigate('/dispatcher/job-orders') }, 2500)
        } catch (err) {
          setError(err.message)
          throw err
        }
      },
    })
  }

  const handleDelete = (id) => {
    requestConfirmation({
      title: 'Delete Inquiry',
      message: 'Are you sure you want to delete this inquiry?',
      detail: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInquiry(id)
          setSelected(null)
          load(page, filter)
        } catch (err) {
          setError(err.message)
          throw err
        }
      },
    })
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'new', 'read', 'replied', 'converted'].map((f) => (
          <button key={f} type="button"
            className={`dx-ocr-tab${filter === f ? ' dx-ocr-tab--active' : ''}`}
            onClick={() => { setFilter(f); setPage(1) }}
            style={{ textTransform: 'capitalize' }}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 420px' }}>
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead><tr>
                <th>Name</th><th>Email</th><th>Inquiry Type</th><th>Status</th><th>Received</th>
              </tr></thead>
              <tbody>
                {inquiries.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>No inquiries.</td></tr>
                )}
                {inquiries.map((inq) => (
                  <tr key={inq.id} role="button" tabIndex={0} style={{ cursor: 'pointer',
                    outline: selected?.id === inq.id ? '2px solid var(--primary)' : 'none' }}
                    onClick={() => handleSelect(inq)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(inq) }}
                  >
                    <td><strong>{inq.name}</strong></td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{inq.email}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', textTransform: 'capitalize' }}>
                      {inq.inquiry_type ? String(inq.inquiry_type).replace(/_/g, ' ') : '—'}
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
                {selected.reference_no && (
                  <div className="dx-kv"><span>Ticket</span><strong>{selected.reference_no}</strong></div>
                )}
                <div className="dx-kv"><span>Name</span><strong>{selected.name}</strong></div>
                <div className="dx-kv"><span>Email</span><strong>{selected.email}</strong></div>
                <div className="dx-kv"><span>Phone</span><strong>{selected.phone ?? '—'}</strong></div>
                <div className="dx-kv"><span>Inquiry type</span><strong style={{ textTransform: 'capitalize' }}>{selected.inquiry_type ? String(selected.inquiry_type).replace(/_/g, ' ') : '—'}</strong></div>
                {selected.subject && (
                  <div className="dx-kv"><span>Subject</span><strong>{selected.subject}</strong></div>
                )}
                <div className="dx-kv"><span>Reference job</span><strong>{selected.reference_job_order?.tracking_code ?? (selected.reference_job_order_id ? `#${selected.reference_job_order_id}` : '—')}</strong></div>
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

                {selected.admin_reply && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 4, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)' }}>
                      Previous reply
                      {selected.replied_at ? ` · ${new Date(selected.replied_at).toLocaleString()}` : ''}
                      {selected.replied_by_user?.name ? ` · ${selected.replied_by_user.name}` : ''}
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selected.admin_reply}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 18 }}>
                  <label htmlFor="inquiry-reply" style={{ display: 'block', marginBottom: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)' }}>
                    Reply by email to {selected.email}
                  </label>
                  <textarea
                    id="inquiry-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={5}
                    placeholder="Write your response to the customer…"
                    disabled={replying}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      minHeight: 110,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid var(--stroke)',
                      font: 'inherit',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      background: 'var(--surface)',
                    }}
                  />
                  <button
                    type="button"
                    className="btn-dx-primary"
                    style={{ marginTop: 10, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    disabled={replying || replyText.trim().length < 5}
                    onClick={handleReply}
                  >
                    {replying ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Send size={16} />}
                    {replying ? 'Sending…' : selected.admin_reply ? 'Send another reply' : 'Send reply'}
                  </button>
                </div>

                {selected.status !== 'converted' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button type="button" className="btn-dx-secondary"
                      style={{ fontSize: '0.8rem', padding: '7px 14px', flex: 1 }}
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
      {confirmationModal}
    </section>
  )
}

export default InquiriesPage
