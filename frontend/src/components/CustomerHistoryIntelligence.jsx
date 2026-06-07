import { History, Loader2 } from 'lucide-react'

function Stat({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fff', border: '1px solid var(--stroke)' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  )
}

function CustomerHistoryIntelligence({ history, loading, error }) {
  if (loading) {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: '0.875rem', padding: '8px 0' }}>
        <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
        Loading customer history…
      </div>
    )
  }

  if (error) {
    return <p className="notice error" style={{ gridColumn: '1 / -1', margin: 0 }}>{error}</p>
  }

  if (!history) return null

  const lastDelivery = history.last_delivery_date
    ? new Date(history.last_delivery_date).toLocaleString()
    : 'No completed deliveries yet'

  return (
    <div style={{ gridColumn: '1 / -1', borderRadius: 12, border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <History size={16} color="var(--color-primary)" />
        <strong style={{ fontSize: '0.875rem' }}>Customer History Intelligence</strong>
        {history.total_orders > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Returning customer · recommendations auto-filled below
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat label="Total Previous Orders" value={history.total_orders} />
        <Stat label="Preferred Quarry" value={history.preferred_quarry?.name} />
        <Stat
          label="Most Used Material"
          value={
            history.most_used_material
              ? [history.most_used_material.name, history.most_used_material.specification_name].filter(Boolean).join(' · ')
              : null
          }
        />
        <Stat label="Most Used Vehicle Type" value={history.most_used_vehicle_type?.name} />
        <Stat label="Last Delivery Date" value={lastDelivery} />
      </div>
    </div>
  )
}

export default CustomerHistoryIntelligence
