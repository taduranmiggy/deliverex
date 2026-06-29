import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { fetchMyConcerns, sendCustomerConcern, sendInquiry } from '../../api/customer'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import InquiryForm from '../../components/customer/InquiryForm'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import { PaginationBar, StatusBadge } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { useToast } from '../../context/ToastContext'
import { CONCERN_TYPE_LABELS, FEEDBACK_STATUS_LABELS } from '../../utils/inquiryForm'
import { MessageSquarePlus } from 'lucide-react'

function CustomerFeedbackPage() {
  const { user, isAuthenticated, role } = useAuth()
  const { paths } = useCustomerSurface()
  const toast = useToast()
  const isCustomer = isAuthenticated && role === 'customer'
  const signInPath = paths.signIn

  const [concerns, setConcerns] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ last_page: 1, total: 0 })
  const [formKey, setFormKey] = useState(0)
  const [showForm, setShowForm] = useState(true)

  const prefill = isCustomer && user
    ? { name: user.name ?? '', email: user.email ?? '', phone: user.phone ?? '' }
    : undefined

  const loadConcerns = useCallback(async (p = 1) => {
    if (!isCustomer) return
    setLoading(true)
    try {
      const res = await fetchMyConcerns(p)
      setConcerns(res.data ?? [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
      setPage(res.current_page ?? p)
    } catch {
      setConcerns([])
    } finally {
      setLoading(false)
    }
  }, [isCustomer])

  useEffect(() => {
    loadConcerns(page)
  }, [loadConcerns, page])

  const handleSubmit = useCallback(async (payload) => {
    if (isCustomer) {
      await sendCustomerConcern(payload)
    } else {
      await sendInquiry(payload)
    }
  }, [isCustomer])

  const handleSuccess = () => {
    setShowForm(false)
    if (isCustomer) {
      loadConcerns(1)
    }
  }

  return (
    <CustomerPageShell>
      <CustomerPageHeader
        eyebrow="Support"
        title="Feedback & Concerns"
        description="Share complaints, suggestions, or delivery concerns. Signed-in customers can track submission status here."
      />

      <div className="customer-feedback-stack">
        <section className="pwa-section">
          <div className="customer-feedback-section-head">
            <h2 className="pwa-section__title">
              <MessageSquarePlus size={18} /> Submit feedback
            </h2>
            {!showForm && isCustomer ? (
              <button type="button" className="btn-dx-secondary btn-sm" onClick={() => { setShowForm(true); setFormKey((k) => k + 1) }}>
                New feedback
              </button>
            ) : null}
          </div>

          {showForm ? (
            <InquiryForm
              key={formKey}
              className="dx-inquiry-form--card"
              onSubmit={handleSubmit}
              showConcernType
              defaultConcernType="complaint"
              defaultValues={prefill}
              showToast={toast}
              successMessage="Thank you — your feedback has been submitted."
              submitLabel="Submit feedback"
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="pwa-empty-state pwa-empty-state--success dx-fade-in">
              <p className="pwa-empty-state__title">Feedback submitted</p>
              <p className="pwa-empty-state__message">
                {isCustomer
                  ? 'Your concern is listed below. Our team will follow up via email.'
                  : 'Our team will follow up via email.'}
              </p>
              {!isCustomer ? (
                <p className="pwa-section__hint" style={{ marginTop: 12 }}>
                  <Link to={signInPath} className="auth-inline-link">Sign in</Link>
                  {' '}to track your feedback status.
                </p>
              ) : null}
            </div>
          )}

          {!isCustomer && showForm ? (
            <p className="pwa-section__hint">
              <Link to={signInPath} className="auth-inline-link">Sign in</Link>
              {' '}to view and track your submitted concerns.
            </p>
          ) : null}
        </section>

        {isCustomer ? (
          <section className="pwa-section">
            <h2 className="pwa-section__title">My concerns</h2>
            {loading ? (
              <CustomerSkeleton count={3} />
            ) : concerns.length === 0 ? (
              <div className="pwa-empty-state">
                <p className="pwa-empty-state__title">No feedback yet</p>
                <p className="pwa-empty-state__message">Submitted complaints and concerns will appear here.</p>
              </div>
            ) : (
              <>
                <div className="customer-feedback-list">
                  {concerns.map((item) => (
                    <article key={item.id} className="customer-feedback-card">
                      <div className="customer-feedback-card__head">
                        <div>
                          <p className="customer-feedback-card__ref">{item.reference_no}</p>
                          <h3 className="customer-feedback-card__subject">{item.subject}</h3>
                        </div>
                        <StatusBadge
                          status={item.status}
                          label={FEEDBACK_STATUS_LABELS[item.status] ?? item.status}
                        />
                      </div>
                      <p className="customer-feedback-card__meta">
                        {CONCERN_TYPE_LABELS[item.inquiry_type] ?? item.inquiry_type}
                        {' · '}
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                      </p>
                      <p className="customer-feedback-card__message">{item.message}</p>
                    </article>
                  ))}
                </div>
                {meta.total > 6 ? (
                  <PaginationBar
                    page={page}
                    total={meta.total}
                    onPage={setPage}
                  />
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </div>
    </CustomerPageShell>
  )
}

export default CustomerFeedbackPage
