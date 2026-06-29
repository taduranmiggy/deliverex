import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { FormValidationSummary } from '../../components/ui'
import { sendInquiry } from '../../api/customer'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { useToast } from '../../context/ToastContext'
import useFormSubmit from '../../hooks/useFormSubmit'
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
    q: 'How do I get a customer account?',
    a: 'Accounts are created by your administrator or linked automatically when a dispatcher creates a delivery using your email.',
  },
  {
    q: 'How do I reset my password?',
    a: 'On the customer login page, choose Forgot Password and enter your account email. A reset link will be sent if the account exists.',
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
  const { paths } = useCustomerSurface()
  const toast = useToast()
  const isCustomer = isAuthenticated && role === 'customer'
  const signInPath = paths.signIn
  const [chatOpen, setChatOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    clearFieldError(k)
  }

  const submitInquiry = useCallback(async (payload) => {
    await sendInquiry(payload)
  }, [])

  const {
    submit,
    submitting,
    error,
    fieldErrors,
    clearFieldError,
    reset,
  } = useFormSubmit(submitInquiry, {
    successMessage: 'Inquiry submitted. Our team will respond as soon as possible.',
    showToast: toast,
    onSuccess: () => {
      setSent(true)
      reset()
    },
  })

  useEffect(() => {
    if (isCustomer && user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.name || '',
        email: f.email || user.email || '',
      }))
    }
  }, [isCustomer, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await submit({
      ...form,
      name: form.name || (isCustomer ? user?.name : ''),
      email: form.email || (isCustomer ? user?.email : ''),
      inquiry_type: 'delivery_inquiry',
      reference_job_order_id: null,
    })
  }

  return (
    <CustomerPageShell>
      <CustomerPageHeader
        eyebrow="Support"
        title="Contact & Help"
        description="Get assistance with tracking, deliveries, and account questions."
      />

      <div className="customer-support-stack">
        <div className="customer-support-actions">
          <CustomerActionCard
            layout="inline"
            icon={MessageSquare}
            title="Chat Assistant"
            description="Instant answers about tracking and services"
            onClick={() => setChatOpen(true)}
          />
          <CustomerActionCard
            layout="inline"
            icon={Phone}
            title="Call Support"
            description="+63 995 582 0222"
            onClick={() => { window.location.href = 'tel:+639955820222' }}
          />
          <CustomerActionCard
            layout="inline"
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
            <div className="pwa-empty-state pwa-empty-state--success dx-fade-in">
              <p className="pwa-empty-state__title">Inquiry submitted</p>
              <p className="pwa-empty-state__message">Our team will respond as soon as possible.</p>
              <button type="button" className="btn-dx-secondary btn-sm" onClick={() => setSent(false)}>Send another</button>
            </div>
          ) : (
            <form className="pwa-form-card" onSubmit={handleSubmit} noValidate>
              <FormValidationSummary error={error} />
              <label>
                Name
                <input
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Your name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'field-error-name' : undefined}
                />
                {fieldErrors.name ? <span id="field-error-name" className="form-error">{fieldErrors.name}</span> : null}
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'field-error-email' : undefined}
                />
                {fieldErrors.email ? <span id="field-error-email" className="form-error">{fieldErrors.email}</span> : null}
              </label>
              <label>
                Phone
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" />
              </label>
              <label>
                Subject
                <input
                  required
                  value={form.subject}
                  onChange={set('subject')}
                  placeholder="How can we help?"
                  aria-invalid={Boolean(fieldErrors.subject)}
                  aria-describedby={fieldErrors.subject ? 'field-error-subject' : undefined}
                />
                {fieldErrors.subject ? <span id="field-error-subject" className="form-error">{fieldErrors.subject}</span> : null}
              </label>
              <label>
                Message
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Describe your concern…"
                  aria-invalid={Boolean(fieldErrors.message)}
                  aria-describedby={fieldErrors.message ? 'field-error-message' : undefined}
                />
                {fieldErrors.message ? <span id="field-error-message" className="form-error">{fieldErrors.message}</span> : null}
              </label>
              <button type="submit" className="btn-dx-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit inquiry'}
              </button>
            </form>
          )}
        </section>

        {!isCustomer && (
          <p className="pwa-section__hint">
            <Link to={signInPath} className="auth-inline-link">Sign in</Link>
            {' '}to link deliveries when submitting inquiries.
          </p>
        )}
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </CustomerPageShell>
  )
}

export default CustomerSupportPage
