import { validatePhPhone } from './phonePh'

export const CONCERN_TYPES = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'feedback', label: 'Feedback / Suggestion' },
  { value: 'delivery_inquiry', label: 'Delivery concern' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'general_question', label: 'General question' },
]

export const CONCERN_TYPE_LABELS = Object.fromEntries(
  CONCERN_TYPES.map(({ value, label }) => [value, label]),
)

export const FEEDBACK_STATUS_LABELS = {
  new: 'Submitted',
  read: 'Under review',
  converted: 'Resolved',
}

export const EMPTY_INQUIRY_FORM = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

export function validateInquiryForm(form, { requirePhone = false, requireConcernType = false } = {}) {
  const errors = {}
  const name = String(form.name ?? '').trim()
  const email = String(form.email ?? '').trim()
  const subject = String(form.subject ?? '').trim()
  const message = String(form.message ?? '').trim()
  const concernType = String(form.concernType ?? '').trim()

  if (requireConcernType && !concernType) {
    errors.concernType = 'Select a concern type.'
  }

  if (!name) errors.name = 'Name is required.'
  else if (name.length > 120) errors.name = 'Name must be 120 characters or less.'

  if (!email) errors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'

  const phoneErr = validatePhPhone(form.phone, { required: requirePhone })
  if (phoneErr) errors.phone = phoneErr

  if (!subject) errors.subject = 'Subject is required.'
  else if (subject.length > 200) errors.subject = 'Subject must be 200 characters or less.'

  if (!message) errors.message = 'Message is required.'
  else if (message.length > 2000) errors.message = 'Message must be 2000 characters or less.'

  return errors
}

export function buildInquiryPayload(form, { inquiryType, referenceJobOrderId = null } = {}) {
  const type = inquiryType || form.concernType || 'general_question'
  return {
    name: String(form.name ?? '').trim(),
    email: String(form.email ?? '').trim().toLowerCase(),
    phone: form.phone || null,
    subject: String(form.subject ?? '').trim(),
    message: String(form.message ?? '').trim(),
    inquiry_type: type,
    reference_job_order_id: referenceJobOrderId,
  }
}
