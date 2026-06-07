import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../../components/ui'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'
import { CheckCircle2, ExternalLink, FileText, MapPin, Package, Truck, X } from 'lucide-react'

function formatDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateFull(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Mini progress bar reused inside modal ─────────────────── */
const STATUS_STEPS = [
  { key: 'pending',     label: 'Order Created' },
  { key: 'assigned',    label: 'Assigned' },
  { key: 'in_progress', label: 'En Route' },
  { key: 'arrived',     label: 'Arrived' },
  { key: 'completed',   label: 'Delivered' },
]
const STATUS_IDX = { pending: 0, assigned: 1, in_progress: 2, arrived: 3, completed: 4, cancelled: -1 }

function DeliveryTimeline({ status }) {
  const currentIdx = STATUS_IDX[status] ?? 0
  if (status === 'cancelled') {
    return (
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
        This delivery was cancelled.
      </div>
    )
  }
  return (
    <div style={{ padding: '4px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STATUS_STEPS.map((step, idx) => {
          const done   = idx < currentIdx
          const active = idx === currentIdx
          const future = idx > currentIdx
          return (
            <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {idx < STATUS_STEPS.length - 1 && (
                <div style={{ position: 'absolute', top: 15, left: '50%', right: '-50%', height: 3, background: done ? 'var(--color-primary)' : '#e2e8f0', borderRadius: 2, zIndex: 0 }} />
              )}
              <div style={{
                width: 30, height: 30, borderRadius: '50%', zIndex: 1, position: 'relative', flexShrink: 0,
                background: done || active ? 'var(--color-primary)' : '#e2e8f0',
                display: 'grid', placeItems: 'center',
                boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none',
              }}>
                {done ? (
                  <CheckCircle2 size={14} color="#fff" />
                ) : (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: active ? '#fff' : '#94a3b8' }}>{idx + 1}</span>
                )}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500, color: active ? 'var(--color-primary)' : future ? '#94a3b8' : '#64748b', marginTop: 6, textAlign: 'center', lineHeight: 1.3 }}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Delivery Detail Modal ─────────────────────────────────── */
function DeliveryDetailModal({ order, onClose }) {
  if (!order) return null

  const pickup  = buildDisplayAddress('pickup', order)
  const dropoff = buildDisplayAddress('dropoff', order)
  const hasPod  = Array.isArray(order.documents) && order.documents.length > 0

  const KV = ({ label, value, mono }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: 16 }}>
      <span style={{ fontSize: '0.8125rem', color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', textAlign: 'right', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  ) : null

  const Section = ({ title, icon: Icon, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #f1f5f9' }}>
        {Icon && <Icon size={14} style={{ color: 'var(--color-primary)' }} />}
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>{title}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15,23,42,0.22)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Delivery details"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Details</p>
            <p style={{ margin: '3px 0 0', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.125rem', color: '#0f172a', letterSpacing: '0.04em' }}>
              {order.tracking_code || `#${order.id}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={order.status} />
            <button type="button" onClick={onClose}
              style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <X size={16} color="#64748b" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 22px' }}>

          {/* Progress */}
          <Section title="Delivery Progress">
            <DeliveryTimeline status={order.status} />
          </Section>

          {/* Delivery Overview */}
          <Section title="Overview" icon={FileText}>
            <KV label="Tracking ID" value={order.tracking_code} mono />
            <KV label="Status" value={<StatusBadge status={order.status} />} />
            <KV label="Priority" value={order.priority ? order.priority.charAt(0).toUpperCase() + order.priority.slice(1) : null} />
            <KV label="Scheduled Start" value={formatDateFull(order.scheduled_start)} />
            <KV label="Scheduled End" value={formatDateFull(order.scheduled_end)} />
          </Section>

          {/* Route */}
          <Section title="Route" icon={MapPin}>
            {order.quarry?.quarry_name && <KV label="Quarry / Supplier" value={order.quarry.quarry_name} />}
            <KV label="Pickup" value={pickup || null} />
            <KV label="Drop-off" value={dropoff || null} />
          </Section>

          {/* Material */}
          {(order.material_type || order.specification_size || order.load_volume_m3 || order.volume_m3) && (
            <Section title="Material &amp; Load" icon={Package}>
              <KV label="Material Type" value={order.material_type} />
              <KV label="Specification" value={order.specification_size} />
              <KV label="Volume" value={(order.load_volume_m3 || order.volume_m3) ? `${order.load_volume_m3 ?? order.volume_m3} m³` : null} />
            </Section>
          )}

          {/* Assignment */}
          {(order.assignments?.[0]?.driver || order.assignments?.[0]?.vehicle) && (
            <Section title="Driver &amp; Vehicle" icon={Truck}>
              <KV label="Driver" value={order.assignments[0].driver?.user?.name ?? order.assignments[0].driver?.name ?? null} />
              <KV label="Plate Number" value={order.assignments[0].vehicle?.plate_no ?? null} />
              <KV label="Vehicle Type" value={order.assignments[0].vehicle?.vehicle_type?.name ?? null} />
            </Section>
          )}

          {/* Proof of Delivery */}
          <Section title="Proof of Delivery">
            {hasPod ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.documents.map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{doc.label || doc.type || 'Document'}</p>
                      {doc.uploaded_at && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>Uploaded {formatDate(doc.uploaded_at)}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {doc.type !== 'signature' && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: doc.ocr_ready ? '#dcfce7' : '#fef9c3', color: doc.ocr_ready ? '#166534' : '#854d0e' }}>
                          {doc.ocr_ready ? 'Verified' : 'Processing'}
                        </span>
                      )}
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                          View <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                {order.status === 'completed' ? 'No documents were uploaded for this delivery.' : 'Proof of delivery will appear here once the shipment is completed.'}
              </p>
            )}
          </Section>

          {/* Special handling */}
          {order.job_requirements && (
            <Section title="Special Handling Instructions">
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>{order.job_requirements}</p>
            </Section>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
          <Link
            to="/customer/track"
            state={{ prefillTracking: order.tracking_code }}
            className="btn-dx-primary btn-sm"
            style={{ flexShrink: 0 }}
            onClick={onClose}
          >
            Track Shipment
          </Link>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────── */
function CustomerDeliveriesPage() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [tab, setTab]             = useState('all')
  const [selected, setSelected]   = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) setRows(res?.data ?? []) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ACTIVE_STATUSES    = new Set(['pending', 'assigned', 'dispatched', 'in_progress', 'en_route', 'arrived'])
  const COMPLETED_STATUSES = new Set(['completed', 'completed_with_pod'])

  const filteredRows = rows.filter((r) => {
    const status = String(r.status || '').toLowerCase()
    if (tab === 'active')    return ACTIVE_STATUSES.has(status)
    if (tab === 'completed') return COMPLETED_STATUSES.has(status)
    return true
  })

  const DeliveryRow = ({ r }) => {
    const hasPod = Array.isArray(r.documents) && r.documents.length > 0
    return (
      <tr>
        <td>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', background: 'var(--slate-100)', padding: '3px 8px', borderRadius: 6 }}>
            {r.tracking_code || `#${r.id}`}
          </span>
        </td>
        <td><StatusBadge status={r.status} /></td>
        <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
          {formatDate(r.status_at || r.updated_at)}
        </td>
        <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
          {buildDisplayAddress('pickup', r)} → {buildDisplayAddress('dropoff', r)}
        </td>
        <td>
          {hasPod
            ? <span style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600 }}>Available</span>
            : <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>—</span>}
        </td>
        <td>
          <button
            type="button"
            className="btn-dx-primary btn-sm"
            onClick={() => setSelected(r)}
          >
            Details
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="customer-content" style={{ paddingTop: 32 }}>
      <PageHeader title="My Deliveries" subtitle="Review all shipments and delivery records associated with your account.">
        <Link to="/customer/track" className="btn-dx-secondary btn-sm">Track by code</Link>
      </PageHeader>

      {error && <p className="notice error">{error}</p>}

      {loading ? (
        <div className="dx-panel" style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px' }}>
          Loading your deliveries…
        </div>
      ) : rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Package}
            title="No deliveries yet"
            message="Deliveries linked to your account will appear here. You can also look up any shipment using a tracking code."
            action={<Link to="/customer/track" className="btn-dx-primary">Track a delivery</Link>}
          />
        </SectionCard>
      ) : (
        <SectionCard>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { key: 'all',       label: `All (${rows.length})` },
              { key: 'active',    label: `Active (${rows.filter((r) => ACTIVE_STATUSES.has(String(r.status || '').toLowerCase())).length})` },
              { key: 'completed', label: `Completed (${rows.filter((r) => COMPLETED_STATUSES.has(String(r.status || '').toLowerCase())).length})` },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dx-ocr-tab${tab === item.key ? ' dx-ocr-tab--active' : ''}`}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Status</th>
                  <th>Last Update</th>
                  <th>Route</th>
                  <th>Proof of Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                      No deliveries found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => <DeliveryRow key={r.id} r={r} />)
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {selected && <DeliveryDetailModal order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default CustomerDeliveriesPage
