import { Link } from 'react-router-dom'
import { useState } from 'react'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import InquiryForm from '../../components/customer/InquiryForm'
import PublicFaqSection from '../../components/customer/PublicFaqSection'
import { SUPPORT_PAGE_FAQS } from '../../data/publicFaqs'
import { sendInquiry } from '../../api/customer'
import { SUPPORT_EMAIL, SUPPORT_PHONE_HREF } from '../../config/support'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { useToast } from '../../context/ToastContext'
import {
  Mail, MessageSquare, MessageSquarePlus, Phone,
} from 'lucide-react'

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
            description={SUPPORT_EMAIL}
            onClick={() => { window.location.href = `mailto:${SUPPORT_EMAIL}` }}
          />
        </div>

        <div className="customer-support-faq-inquiry">
          <section className="pwa-section customer-support-faq-inquiry__col">
            <PublicFaqSection
              variant="support"
              items={SUPPORT_PAGE_FAQS}
              showSearch={false}
              showCategories={false}
              singleOpen
              title="Frequently Asked Questions"
              description="Quick answers to the most common questions. For anything else, chat with the Deliverex Assistant."
              footer={(
                <>
                  <p className="dx-public-faq__chat-text">
                    Can&apos;t find what you&apos;re looking for? Chat with the Deliverex Assistant for instant help.
                  </p>
                  <button
                    type="button"
                    className="btn-dx-primary btn-sm dx-public-faq__chat-btn"
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageSquare size={16} aria-hidden />
                    Open Chat Assistant
                  </button>
                </>
              )}
            />
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
