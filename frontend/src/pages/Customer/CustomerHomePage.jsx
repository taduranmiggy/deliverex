import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCustomerOrders, sendInquiry } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'
import useAuth from '../../hooks/useAuth'
import {
  BriefcaseBusiness, ChevronRight, HeadphonesIcon, History, Info,
  MapPin, MessageSquare, Package, Search,
} from 'lucide-react'

function CustomerHomePage() {
  const { isAuthenticated, role, user } = useAuth()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [trackCode, setTrackCode] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', inquiry_type: 'delivery_inquiry', subject: '', reference_job_order_id: '', message: '' })
  const [contactResult, setContactResult] = useState(null)
  const [contactError, setContactError] = useState('')
  const [sending, setSending] = useState(false)
  const [customerOrders, setCustomerOrders] = useState([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  const isCustomer = isAuthenticated && role === 'customer'

  // Load customer orders once on mount for summary stats
  useEffect(() => {
    if (!isCustomer) return
    let cancelled = false
    setLoadingRefs(true)
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) { setCustomerOrders(res?.data ?? []); setOrdersLoaded(true) } })
      .catch(() => { if (!cancelled) { setCustomerOrders([]); setOrdersLoaded(true) } })
      .finally(() => { if (!cancelled) setLoadingRefs(false) })
    return () => { cancelled = true }
  }, [isCustomer])

  // Pre-fill contact form when opened
  useEffect(() => {
    if (!contactOpen) return
    setContactForm((prev) => ({
      ...prev,
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    }))
  }, [contactOpen, user?.email, user?.name, user?.phone])

  const activeStatuses = ['pending', 'assigned', 'in_progress', 'arrived']
  const now = new Date()
  const thisMonth = { year: now.getFullYear(), month: now.getMonth() }

  const stats = useMemo(() => {
    if (!ordersLoaded) return null
    const active = customerOrders.filter((o) => activeStatuses.includes(o.status)).length
    const inTransit = customerOrders.filter((o) => o.status === 'in_progress').length
    const completedThisMonth = customerOrders.filter((o) => {
      if (o.status !== 'completed') return false
      const d = o.updated_at ? new Date(o.updated_at) : null
      return d && d.getFullYear() === thisMonth.year && d.getMonth() === thisMonth.month
    }).length
    const delayed = customerOrders.filter((o) => {
      if (!activeStatuses.includes(o.status)) return false
      if (!o.scheduled_end) return false
      return new Date(o.scheduled_end) < now
    }).length
    return { active, inTransit, completedThisMonth, delayed }
  }, [customerOrders, ordersLoaded]) // eslint-disable-line

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
      const res = await sendInquiry({
        ...contactForm,
        reference_job_order_id: contactForm.reference_job_order_id ? Number(contactForm.reference_job_order_id) : null,
      })
      setContactResult(res)
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
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
        padding: isCustomer ? '48px 24px 72px' : '64px 24px 88px',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Greeting */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 'clamp(1.625rem, 3vw, 2.5rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.18, marginBottom: 10, color: '#fff' }}>
              {isCustomer
                ? <>Welcome back, <span style={{ color: '#93c5fd' }}>{user?.name}</span></>
                : 'Track Your Delivery'
              }
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', lineHeight: 1.6, maxWidth: 520 }}>
              {isCustomer
                ? 'Monitor your delivery progress, estimated arrivals, and proof-of-delivery records — all in one place.'
                : 'Enter your Job Order ID to view delivery status, estimated arrival, and proof-of-delivery updates.'}
            </p>
          </div>

          {/* Primary action — Tracking input */}
          <form onSubmit={handleTrack} style={{ display: 'flex', gap: 8, maxWidth: 520, marginBottom: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Enter tracking ID…"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.09)', color: '#fff', fontSize: '0.9375rem', backdropFilter: 'blur(10px)', outline: 'none' }}
              />
            </div>
            <button type="submit" style={{ padding: '0 24px', borderRadius: 12, background: '#fff', color: '#1e3a8a', border: 'none', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              Track Shipment
            </button>
          </form>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8125rem' }}>e.g. XKFP2NQRLA</p>

          {/* Delivery summary stats — authenticated customers only */}
          {isCustomer && stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 32 }}>
              {[
                { label: 'Active Deliveries', value: stats.active, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)' },
                { label: 'In Transit', value: stats.inTransit, color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)' },
                { label: 'Completed This Month', value: stats.completedThisMonth, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
                { label: 'Delayed', value: stats.delayed, color: stats.delayed > 0 ? '#f87171' : 'rgba(255,255,255,0.5)', bg: stats.delayed > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)', border: stats.delayed > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="dx-hero-stat" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {isCustomer && !stats && loadingRefs && (
            <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ flex: 1, height: 72, borderRadius: 12, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          )}
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
              { icon: Info, label: 'About Deliverex', to: '/customer/about' },
              { icon: BriefcaseBusiness, label: 'Our Services', to: '/customer/services' },
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
                {contactResult ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-success-light)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                      <Package size={26} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 8 }}>Concern submitted</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                      {contactResult?.message || 'Your concern has been submitted successfully.'}
                    </p>
                    {contactResult?.reference_no && (
                      <p style={{ marginTop: 8, fontSize: '0.875rem' }}>
                        <strong>Reference No:</strong> {contactResult.reference_no}
                      </p>
                    )}
                    <button type="button" className="btn-dx-primary" style={{ marginTop: 20 }} onClick={() => { setContactOpen(false); setContactResult(null) }}>Close</button>
                  </div>
                ) : (
                  <form className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }} onSubmit={handleContact}>
                    <div style={{ gridColumn: '1 / -1', border: '1px solid var(--stroke)', borderRadius: 12, background: 'var(--surface-soft, #f8fafc)', padding: '12px 14px' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Official Contact Details</p>
                      <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Phone: <a href="tel:+639955820222" className="auth-inline-link">+639955820222</a>
                      </p>
                      <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Email: <a href="mailto:deliverex.support@gmail.com" className="auth-inline-link">deliverex.support@gmail.com</a>
                      </p>
                    </div>
                    <label style={{ gridColumn: '1 / -1' }}>Name <input required value={contactForm.name} onChange={set('name')} placeholder="Your name" /></label>
                    <label>Email
                      <input
                        required
                        type="email"
                        value={contactForm.email}
                        onChange={set('email')}
                        placeholder="you@example.com"
                        onInvalid={(e) => e.currentTarget.setCustomValidity(
                          e.currentTarget.validity.valueMissing ? 'Email is required.' : 'Please enter a valid email address.',
                        )}
                        onInput={(e) => e.currentTarget.setCustomValidity('')}
                      />
                    </label>
                    <label>Phone <input type="tel" value={contactForm.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" /></label>
                    <label style={{ gridColumn: '1 / -1' }}>Subject <input required value={contactForm.subject} onChange={set('subject')} placeholder="Enter concern subject" /></label>
                    <label>
                      Subject / Inquiry Type
                      <select required value={contactForm.inquiry_type} onChange={set('inquiry_type')}>
                        <option value="delivery_inquiry">Delivery Inquiry</option>
                        <option value="complaint">Complaint</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="general_question">General Question</option>
                      </select>
                    </label>
                    <label>
                      Reference Job (optional)
                      <select
                        value={contactForm.reference_job_order_id}
                        onChange={set('reference_job_order_id')}
                        disabled={!isCustomer || loadingRefs}
                      >
                        <option value="">{isCustomer ? '— Select Job Order ID —' : 'Sign in to link a job order'}</option>
                        {customerOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.tracking_code} ({buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)})
                          </option>
                        ))}
                      </select>
                      {isCustomer && loadingRefs ? (
                        <span style={{ display: 'block', marginTop: 6, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                          Loading your delivery references…
                        </span>
                      ) : null}
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>Message <textarea required rows={3} value={contactForm.message} onChange={set('message')} placeholder="Tell us about your delivery needs…" /></label>
                    {contactError && <p className="notice error" style={{ margin: 0, gridColumn: '1 / -1' }}>{contactError}</p>}
                    <div style={{ display: 'flex', gap: 10, gridColumn: '1 / -1' }}>
                      <button type="submit" className="btn-dx-primary" disabled={sending}>{sending ? 'Submitting…' : 'Submit Concern'}</button>
                      <button type="button" className="btn-dx-secondary" onClick={() => setContactOpen(false)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feature cards — guest only; authenticated customers see their live stats above */}
        {!isCustomer && (
          <div className="dx-feature-cards">
            {[
              {
                icon: MapPin,
                title: 'Delivery Tracking',
                desc: 'Enter your Job Order ID to view current delivery status and estimated arrival time.',
                color: 'var(--color-primary)',
                bg: 'var(--color-primary-light)',
              },
              {
                icon: Package,
                title: 'Proof of Delivery',
                desc: 'Access signed delivery confirmation records once your shipment is completed.',
                color: '#7c3aed',
                bg: '#ede9fe',
              },
              {
                icon: History,
                title: 'Delivery History',
                desc: 'Review your past deliveries, routes, schedules, and completion records.',
                color: '#0891b2',
                bg: '#e0f2fe',
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="dx-feature-card">
                <div className="dx-feature-card__icon" style={{ background: bg, color }}>
                  <Icon size={24} aria-hidden />
                </div>
                <p className="dx-feature-card__title">{title}</p>
                <p className="dx-feature-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {!isCustomer && (
          <div style={{ marginTop: 32, textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--stroke)' }}>
            <p style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: 8 }}>Ready to track your deliveries?</p>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Create an account to view all deliveries linked to your email and access your full delivery history and status records.</p>
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
