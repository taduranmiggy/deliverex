import { Link } from 'react-router-dom'
import { useState } from 'react'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import InquiryForm from '../../components/customer/InquiryForm'
import { sendInquiry } from '../../api/customer'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { useToast } from '../../context/ToastContext'
import {
  ChevronDown, Mail, MessageSquare, MessageSquarePlus, Phone, HelpCircle,
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
  const [formKey, setFormKey] = useState(0)
  const prefill = isCustomer && user
    ? { name: user.name ?? '', email: user.email ?? '', phone: user.phone ?? '' }
    : undefined

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
            icon={MessageSquarePlus}
            title="Feedback & Concerns"
            description="Submit complaints, suggestions, or delivery issues"
            to={paths.feedback}
          />
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

        <div className="customer-support-faq-inquiry">
          <section className="pwa-section customer-support-faq-inquiry__col">
            <h2 className="pwa-section__title">
              <HelpCircle size={18} /> Frequently Asked Questions
            </h2>
            <div className="pwa-faq-list">
              {FAQS.map((item) => (
                <FaqItem key={item.q} question={item.q} answer={item.a} />
              ))}
            </div>
          </section>

          <section className="pwa-section customer-support-faq-inquiry__col">
            <h2 className="pwa-section__title">Submit an inquiry</h2>
            {sent ? (
              <div className="pwa-empty-state pwa-empty-state--success dx-fade-in">
                <p className="pwa-empty-state__title">Inquiry submitted</p>
                <p className="pwa-empty-state__message">Our team will respond as soon as possible.</p>
                <button type="button" className="btn-dx-secondary btn-sm" onClick={() => { setSent(false); setFormKey((k) => k + 1) }}>Send another</button>
              </div>
            ) : (
              <InquiryForm
                key={formKey}
                className="dx-inquiry-form--card"
                onSubmit={sendInquiry}
                inquiryType="delivery_inquiry"
                defaultValues={prefill}
                showToast={toast}
                successMessage="Inquiry submitted. Our team will respond as soon as possible."
                onSuccess={() => setSent(true)}
              />
            )}
          </section>
        </div>

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
