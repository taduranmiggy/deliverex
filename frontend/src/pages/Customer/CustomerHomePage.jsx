import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendInquiry } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import useAuth from '../../hooks/useAuth'
import {
  ArrowRight, ChevronRight, HeadphonesIcon, HelpCircle,
  History, MapPin, MessageSquare, Package, Search, Truck,
} from 'lucide-react'

function CustomerHomePage() {
  const { isAuthenticated, role, user } = useAuth()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [trackCode, setTrackCode] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', pickup_location: '', dropoff_location: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')
  const [sending, setSending] = useState(false)

  const isCustomer = isAuthenticated && role === 'customer'

  const handleTrack = (e) => {
    e.preventDefault()
    if (trackCode.trim()) {
      navigate('/customer/track', { state: { prefillTracking: trackCode.trim() } })
    }
  }

  const handleContact = async (e) => {
    e.preventDefault()
    setSending(true)
    setContactError('')
    try {
      await sendInquiry(contactForm)
      setContactSent(true)
    } catch (err) {
      setContactError(err.message)
    } finally {
      setSending(false)
    }
  }

  const set = (k) => (e) => setContactForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div>
      {/* ── Hero Section ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
        padding: '60px 24px 80px',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 99, padding: '5px 14px', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              Real-time tracking active
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 16, color: '#fff' }}>
              {isCustomer
                ? <>Welcome back,<br /><span style={{ color: '#93c5fd' }}>{user?.name} 👋</span></>
                : <>Track and verify your<br />site deliveries</>
              }
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.0625rem', maxWidth: 480, lineHeight: 1.6, marginBottom: 32 }}>
              {isCustomer
                ? 'Track your deliveries in real-time, view delivery history, and stay updated every step of the way.'
                : 'Get live status, ETA windows, and proof-of-delivery confirmation for every shipment.'}
            </p>

            {/* Quick track */}
            <form onSubmit={handleTrack} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Enter tracking ID…"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  style={{ width: '100%', padding: '13px 14px 13px 40px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9375rem', backdropFilter: 'blur(10px)' }}
                />
              </div>
              <button type="submit" className="btn-dx-primary" style={{ padding: '13px 22px', borderRadius: 12, background: '#fff', color: '#1e3a8a', border: 'none', fontWeight: 700, flexShrink: 0 }}>
                Track
              </button>
            </form>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8125rem', marginTop: 10 }}>
              Example: XKFP2NQRLA
            </p>
          </div>

          {/* Hero illustration */}
          <div style={{ display: 'none' }} className="hero-illustration" aria-hidden>
            <div style={{ width: 280, height: 200, background: 'rgba(255,255,255,0.08)', borderRadius: 20, backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={64} style={{ opacity: 0.4 }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Actions + Help Cards ── */}
      <div className="customer-content" style={{ marginTop: -24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>

          {/* Help Center card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: '#fff', border: 'none' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <HeadphonesIcon size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Need Help?</p>
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Chat with our virtual assistant or visit our Help Center.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setChatOpen(true)}
                    className="btn-dx-primary btn-sm"
                    style={{ background: '#fff', color: '#1e40af', border: 'none', borderRadius: 8 }}>
                    Chat with Deliverex →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 12 }}>Quick Actions</p>
            {[
              { icon: MapPin, label: 'Track a Delivery', to: '/customer/track' },
              { icon: Package, label: 'View My Deliveries', to: isCustomer ? '/customer/deliveries' : '/login' },
              { icon: History, label: 'Delivery History', to: isCustomer ? '/customer/deliveries' : '/login' },
              { icon: MessageSquare, label: 'Contact Support', action: () => setContactOpen(true) },
            ].map(({ icon: Icon, label, to, action }) => (
              to ? (
                <Link key={label} to={to} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--stroke)', color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.12s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} style={{ color: 'var(--color-primary)' }} />
                    {label}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                </Link>
              ) : (
                <button key={label} type="button" onClick={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 0', borderBottom: '1px solid var(--stroke)', background: 'none', border: 'none', borderBottom: '1px solid var(--stroke)', color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'color 0.12s', textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} style={{ color: 'var(--color-primary)' }} />
                    {label}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                </button>
              )
            ))}
          </div>
        </div>

        {/* Contact form modal */}
        {contactOpen && (
          <div className="dx-modal-backdrop" onClick={() => setContactOpen(false)}>
            <div className="dx-modal" onClick={(e) => e.stopPropagation()}>
              <div className="dx-modal-header">
                <h2>Contact Support</h2>
                <button type="button" className="dx-modal-close" onClick={() => setContactOpen(false)}>×</button>
              </div>
              <div style={{ padding: '20px 28px 28px' }}>
                {contactSent ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-success-light)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                      <Package size={26} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 8 }}>Message sent!</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Our team will follow up shortly.</p>
                    <button type="button" className="btn-dx-primary" style={{ marginTop: 20 }} onClick={() => { setContactOpen(false); setContactSent(false) }}>Close</button>
                  </div>
                ) : (
                  <form className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }} onSubmit={handleContact}>
                    <label style={{ gridColumn: '1 / -1' }}>Name <input required value={contactForm.name} onChange={set('name')} placeholder="Your name" /></label>
                    <label>Email <input required type="email" value={contactForm.email} onChange={set('email')} placeholder="you@example.com" /></label>
                    <label>Phone <input type="tel" value={contactForm.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" /></label>
                    <label>Pickup Location <input value={contactForm.pickup_location} onChange={set('pickup_location')} placeholder="Where should we pick up?" /></label>
                    <label>Drop-off Location <input value={contactForm.dropoff_location} onChange={set('dropoff_location')} placeholder="Where to deliver?" /></label>
                    <label style={{ gridColumn: '1 / -1' }}>Message <textarea required rows={3} value={contactForm.message} onChange={set('message')} placeholder="Tell us about your delivery needs…" /></label>
                    {contactError && <p className="notice error" style={{ margin: 0, gridColumn: '1 / -1' }}>{contactError}</p>}
                    <div style={{ display: 'flex', gap: 10, gridColumn: '1 / -1' }}>
                      <button type="submit" className="btn-dx-primary" disabled={sending}>{sending ? 'Sending…' : 'Send Inquiry'}</button>
                      <button type="button" className="btn-dx-secondary" onClick={() => setContactOpen(false)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 8 }}>
          {[
            { icon: MapPin, title: 'Real-Time Tracking', desc: 'Live status updates from dispatch to delivery completion.' },
            { icon: Truck, title: 'Fleet Management', desc: 'Complete fleet visibility for all active deliveries.' },
            { icon: Package, title: 'Proof of Delivery', desc: 'Digital confirmation and documents for every shipment.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-light)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                <Icon size={22} style={{ color: 'var(--color-primary)' }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 6 }}>{title}</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.55 }}>{desc}</p>
            </div>
          ))}
        </div>

        {!isCustomer && (
          <div style={{ marginTop: 32, textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--stroke)' }}>
            <p style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: 8 }}>Ready to track your deliveries?</p>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Create an account to see all shipments linked to your email, manage bookings, and receive delivery alerts.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/customer/signup" className="btn-dx-primary btn-lg">Create free account</Link>
              <Link to="/login" className="btn-dx-secondary btn-lg">Sign in</Link>
            </div>
          </div>
        )}
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}

export default CustomerHomePage
