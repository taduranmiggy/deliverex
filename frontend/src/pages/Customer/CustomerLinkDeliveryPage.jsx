import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { linkCustomerDelivery } from '../../api/customer'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import { PageHeader, SectionCard } from '../../components/ui'
import { Link2, Package } from 'lucide-react'

function CustomerLinkDeliveryPage() {
  const [trackingCode, setTrackingCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    const code = trackingCode.trim()
    if (!code) return
    setSubmitting(true)
    try {
      const res = await linkCustomerDelivery(code)
      setMessage(res.message || `Linked ${res.linked_count ?? 1} delivery record(s).`)
      setTrackingCode('')
      setTimeout(() => navigate('/customer/deliveries'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="customer-page customer-page--narrow">
      <PageHeader title="Link a delivery" subtitle="Enter the tracking ID from your shipment confirmation email." />
      <SectionCard>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            Tracking ID
            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
              placeholder="e.g. TRKABC123"
              required
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)' }}>
            The Tracking ID must match a delivery created with your account email.
          </p>
          {error && <p className="notice error" style={{ margin: 0 }}>{error}</p>}
          {message && <p className="notice" style={{ margin: 0 }}>{message}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-dx-primary" disabled={submitting}>
              <Link2 size={16} /> {submitting ? 'Linking…' : 'Link delivery'}
            </button>
            <Link to="/customer/deliveries" className="btn-dx-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} /> My deliveries
            </Link>
          </div>
        </form>
      </SectionCard>
      <LoadingOverlay open={submitting} message="Linking delivery" submessage="Please wait." />
    </div>
  )
}

export default CustomerLinkDeliveryPage
