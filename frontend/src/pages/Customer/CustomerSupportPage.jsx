import { useState } from 'react'
import { Link } from 'react-router-dom'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import { sendInquiry } from '../../api/customer'
import useAuth from '../../hooks/useAuth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import {
  ChevronDown, Mail, MessageSquare, Phone, HelpCircle,
} from 'lucide-react'

const FAQS = [
  {
    q: 'How do I track my delivery?',
    a: 'Enter your Tracking ID on the Track page. No account is required for basic tracking.',
  },
  {
    q: 'Where can I find my Tracking ID?',
    a: 'Your Tracking ID is provided by your dispatcher or logistics provider when the shipment is created.',
  },
  {
    q: 'Can I view proof of delivery?',
    a: 'Yes. Once a delivery is completed, proof-of-delivery records appear in the tracking results and in your delivery history when signed in.',
  },
  {
    q: 'How do I link a delivery to my account?',
    a: 'Sign in, go to Link Delivery, and enter your Tracking ID. The email on the shipment must match your account email.',
  },
  {
    q: 'Who do I contact for delivery issues?',
    a: 'Use the contact form below or reach our support team by phone or email.',
  },
]

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`pwa-faq-item${open ? ' pwa-faq-item--open' : ''}`}>
      <button type="button" className="pwa-faq-item__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{question}</span>
        <ChevronDown size={18} className="pwa-faq-item__chevron" />
      </button>
      <div className="pwa-faq-item__panel">
        <p>{answer}</p>
      </div>
    </div>
  )
}

function CustomerSupportPage() {
  const { user, isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === 'customer'
  const [chatOpen, setChatOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await sendInquiry({
        ...form,
        inquiry_type: 'delivery_inquiry',
        reference_job_order_id: null,
      })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="customer-page pwa-page">
      <header className="pwa-page-header">
        <p className="pwa-page-eyebrow">Support</p>
        <h1>Contact &amp; Help</h1>
        <p>Get assistance with tracking, deliveries, and account questions.</p>
      </header>

      <div className="customer-content" style={{ paddingBottom: 24 }}>
        <div className="pwa-action-grid pwa-action-grid--compact">
          <CustomerActionCard
            icon={MessageSquare}
            title="Chat Assistant"
            description="Instant answers about tracking and services"
            onClick={() => setChatOpen(true)}
          />
          <CustomerActionCard
            icon={Phone}
            title="Call Support"
            description="+63 995 582 0222"
            onClick={() => { window.location.href = 'tel:+639955820222' }}
          />
          <CustomerActionCard
            icon={Mail}
            title="Email Support"
            description="deliverex.support@gmail.com"
            onClick={() => { window.location.href = 'mailto:deliverex.support@gmail.com' }}
          />
        </div>

        <section className="pwa-section">
          <h2 className="pwa-section__title">
            <HelpCircle size={18} /> Frequently Asked Questions
          </h2>
          <div className="pwa-faq-list">
            {FAQS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        <section className="pwa-section">
          <h2 className="pwa-section__title">Submit an inquiry</h2>
          {sent ? (
            <div className="pwa-empty-state pwa-empty-state--success">
              <p className="pwa-empty-state__title">Inquiry submitted</p>
              <p className="pwa-empty-state__message">Our team will respond as soon as possible.</p>
              <button type="button" className="btn-dx-secondary btn-sm" onClick={() => setSent(false)}>Send another</button>
            </div>
          ) : (
            <form className="pwa-form-card" onSubmit={handleSubmit}>
              <label>
                Name
                <input required value={form.name || (isCustomer ? user?.name : '')} onChange={set('name')} placeholder="Your name" />
              </label>
              <label>
                Email
                <input required type="email" value={form.email || (isCustomer ? user?.email : '')} onChange={set('email')} placeholder="you@example.com" />
              </label>
              <label>
                Phone
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" />
              </label>
              <label>
                Subject
                <input required value={form.subject} onChange={set('subject')} placeholder="How can we help?" />
              </label>
              <label>
                Message
                <textarea required rows={4} value={form.message} onChange={set('message')} placeholder="Describe your concern…" />
              </label>
              {error ? <p className="notice error">{error}</p> : null}
              <button type="submit" className="btn-dx-primary" disabled={sending}>
                {sending ? 'Submitting…' : 'Submit inquiry'}
              </button>
            </form>
          )}
        </section>

        {!isCustomer && (
          <p className="pwa-section__hint">
            <Link to="/customer/login" className="auth-inline-link">Sign in</Link>
            {' '}to link deliveries when submitting inquiries.
          </p>
        )}
      </div>

      <LoadingOverlay open={sending} message="Submitting inquiry" submessage="Please wait." />
      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}

export default CustomerSupportPage
