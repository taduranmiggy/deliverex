import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendInquiry } from '../api/customer'
import DeliverexAssistantChat from '../components/DeliverexAssistantChat'
import { ArrowRight, CheckCircle2, Clock, Map, MessageSquare, Package, Search, Shield, Truck, X } from 'lucide-react'

function LandingPage() {
  const navigate = useNavigate()
  const [trackCode, setTrackCode] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')
  const [sending, setSending] = useState(false)

  const handleTrack = (e) => {
    e.preventDefault()
    if (trackCode.trim()) {
      navigate('/customer/track', { state: { prefillTracking: trackCode.trim() } })
    }
  }

  const set = (k) => (e) => setContactForm((f) => ({ ...f, [k]: e.target.value }))
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav className="customer-nav">
        <div className="customer-nav-inner">
          <Link to="/" className="customer-nav-brand">
            <div className="customer-nav-brand-icon" aria-hidden>
              <Truck size={18} color="#fff" />
            </div>
            <span className="customer-nav-brand-text">Deliverex</span>
          </Link>
          <div className="customer-nav-actions" style={{ marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/customer/about" className="customer-nav-link">About</Link>
            <Link to="/customer/services" className="customer-nav-link">Services</Link>
            <Link to="/customer/support" className="btn-dx-secondary btn-sm">Support</Link>
            <Link to="/customer/track" className="btn-dx-secondary btn-sm">Track Delivery</Link>
            <Link to="/login" className="btn-dx-primary btn-sm">Sign in <ArrowRight size={13} /></Link>
          </div>
        </div>
      </nav>

      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #2563eb 100%)', padding: 'clamp(60px, 10vw, 120px) 24px', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: '5px 16px', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 24, backdropFilter: 'blur(10px)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
            Trusted logistics tracking for construction & site services
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 20, color: '#fff' }}>
            Track and verify your<br />site deliveries with confidence.
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.65 }}>
            Deliverex provides live status, ETA windows, and proof-of-delivery confirmation for every shipment.
          </p>

          <form onSubmit={handleTrack} style={{ display: 'flex', gap: 10, maxWidth: 520, margin: '0 auto 20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
              <input
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                placeholder="Enter tracking ID…"
                style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1rem', backdropFilter: 'blur(10px)', outline: 'none' }}
              />
            </div>
            <button type="submit" className="btn-dx-primary" style={{ padding: '14px 28px', borderRadius: 14, background: '#fff', color: '#1e3a8a', border: 'none', fontWeight: 800, fontSize: '1rem' }}>
              Track Now
            </button>
          </form>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem' }}>No account required · Example: XKFP2NQRLA</p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setChatOpen(true)} className="btn-dx-secondary" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
              <MessageSquare size={15} /> Open Assistant
            </button>
            <button type="button" onClick={() => setContactOpen(true)} className="btn-dx-secondary" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}>
              Contact Support
            </button>
          </div>
        </div>
      </section>

      <section className="customer-container" style={{ marginTop: -32, paddingBottom: 80 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 48 }}>
          {[
            { Icon: Map, title: 'Real-Time Status', desc: 'Live updates from dispatch to delivery completion with GPS tracking.' },
            { Icon: Clock, title: 'ETA Windows', desc: 'Accurate arrival estimates and schedule management for better planning.' },
            { Icon: Package, title: 'Proof of Delivery', desc: 'Digital confirmation and documents for every delivery, with OCR processing.' },
            { Icon: Shield, title: 'Secure & Reliable', desc: 'Role-based access ensures the right people see the right information.' },
            { Icon: CheckCircle2, title: 'Best-Fit Assignment', desc: 'AI-powered vehicle and driver assignment for optimal fleet utilization.' },
            { Icon: Truck, title: 'Fleet Management', desc: 'Complete fleet visibility for dispatchers, managers, and administrators.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="card" style={{ background: 'var(--surface)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-primary-light)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                <Icon size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{title}</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 24, padding: '60px 24px', border: '1px solid var(--blue-200)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>Ready to manage your logistics?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '1.0625rem', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Sign in once with your Deliverex account — admin, dispatcher, manager, or customer.
          </p>
          <Link to="/login" className="btn-dx-primary btn-lg">Sign in <ArrowRight size={16} /></Link>
        </div>
      </section>

      <footer style={{ background: 'var(--slate-800)', color: 'rgba(255,255,255,0.5)', padding: '40px 0 24px', fontSize: '0.8125rem' }}>
        <div className="customer-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, marginBottom: 28 }}>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, marginBottom: 10 }}>Deliverex</p>
            <p style={{ lineHeight: 1.6, margin: 0 }}>Logistics dispatch, delivery tracking, and proof-of-delivery for site preparation teams.</p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>Explore</p>
            <p style={{ margin: '6px 0' }}><Link to="/customer/about" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>About Us</Link></p>
            <p style={{ margin: '6px 0' }}><Link to="/customer/services" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Services</Link></p>
            <p style={{ margin: '6px 0' }}><Link to="/customer/support" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Support</Link></p>
            <p style={{ margin: '6px 0' }}><Link to="/customer/track" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Track Delivery</Link></p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>Account</p>
            <p style={{ margin: '6px 0' }}><Link to="/login" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Sign in</Link></p>
            <p style={{ margin: '6px 0' }}><Link to="/customer/signup" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Create account</Link></p>
          </div>
        </div>
        <p style={{ textAlign: 'center', margin: 0, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 20 }}>
          Deliverex Logistics · Providential 628 Site Preparation Services
        </p>
      </footer>

      {contactOpen && (
        <div className="dx-modal-backdrop" onClick={() => setContactOpen(false)}>
          <div className="dx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dx-modal-header">
              <h2>Contact Support</h2>
              <button type="button" className="dx-modal-close" onClick={() => setContactOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 28px 28px' }}>
              {contactSent ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle2 size={40} style={{ color: 'var(--color-success)', margin: '0 auto 16px' }} />
                  <p style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 8 }}>Message sent!</p>
                  <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 20 }}>Our team will follow up shortly.</p>
                  <button type="button" className="btn-dx-primary" onClick={() => { setContactOpen(false); setContactSent(false) }}>Close</button>
                </div>
              ) : (
                <form className="form-grid" style={{ gridTemplateColumns: '1fr' }} onSubmit={handleContact}>
                  <label>Name <input required value={contactForm.name} onChange={set('name')} placeholder="Your full name" /></label>
                  <label>Email <input required type="email" value={contactForm.email} onChange={set('email')} placeholder="you@example.com" /></label>
                  <label>Message <textarea required rows={4} value={contactForm.message} onChange={set('message')} placeholder="How can we help?" /></label>
                  {contactError && <p className="notice error" style={{ margin: 0 }}>{contactError}</p>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn-dx-primary" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
                    <button type="button" className="btn-dx-secondary" onClick={() => setContactOpen(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}

export default LandingPage
