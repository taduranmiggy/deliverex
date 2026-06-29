import { useCallback, useEffect, useState } from 'react'
import PhonePhInput from '../PhonePhInput'
import { FormValidationSummary } from '../ui'
import useFormSubmit from '../../hooks/useFormSubmit'
import { buildInquiryPayload, CONCERN_TYPES, EMPTY_INQUIRY_FORM, validateInquiryForm } from '../../utils/inquiryForm'

function InquiryForm({
  onSubmit,
  inquiryType,
  referenceJobOrderId = null,
  defaultValues = {},
  requirePhone = false,
  showConcernType = false,
  defaultConcernType = 'complaint',
  submitLabel = 'Submit inquiry',
  submittingLabel = 'Submitting…',
  className = '',
  onSuccess,
  showToast,
  successMessage,
  onCancel,
  cancelLabel = 'Cancel',
}) {
  const [form, setForm] = useState({
    ...EMPTY_INQUIRY_FORM,
    concernType: defaultConcernType,
    ...defaultValues,
  })
  const [clientErrors, setClientErrors] = useState({})

  useEffect(() => {
    if (!defaultValues) return
    setForm((prev) => ({
      ...prev,
      name: prev.name || defaultValues.name || '',
      email: prev.email || defaultValues.email || '',
      phone: prev.phone || defaultValues.phone || '',
    }))
  }, [defaultValues?.name, defaultValues?.email, defaultValues?.phone])

  const submitInquiry = useCallback(async (payload) => {
    await onSubmit(payload)
  }, [onSubmit])

  const {
    submit,
    submitting,
    error,
    fieldErrors: serverErrors,
    clearFieldError,
    reset,
  } = useFormSubmit(submitInquiry, {
    successMessage,
    showToast,
    onSuccess: () => {
      setForm({
        ...EMPTY_INQUIRY_FORM,
        concernType: defaultConcernType,
        ...defaultValues,
      })
      setClientErrors({})
      reset()
      onSuccess?.()
    },
  })

  const fieldErrors = { ...clientErrors, ...serverErrors }

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setClientErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    clearFieldError(key)
  }

  const setPhone = (value) => {
    setForm((prev) => ({ ...prev, phone: value }))
    setClientErrors((prev) => {
      if (!prev.phone) return prev
      const next = { ...prev }
      delete next.phone
      return next
    })
    clearFieldError('phone')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateInquiryForm(form, {
      requirePhone,
      requireConcernType: showConcernType,
    })
    if (Object.keys(validation).length > 0) {
      setClientErrors(validation)
      return
    }
    setClientErrors({})
    await submit(buildInquiryPayload(form, { inquiryType, referenceJobOrderId }))
  }

  return (
    <form className={`dx-inquiry-form${className ? ` ${className}` : ''}`} onSubmit={handleSubmit} noValidate>
      <FormValidationSummary error={error} />
      {showConcernType ? (
        <label>
          Concern type
          <select
            required
            value={form.concernType}
            onChange={set('concernType')}
            aria-invalid={Boolean(fieldErrors.concernType)}
            aria-describedby={fieldErrors.concernType ? 'inquiry-error-concern-type' : undefined}
          >
            {CONCERN_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {fieldErrors.concernType ? (
            <span id="inquiry-error-concern-type" className="form-error">{fieldErrors.concernType}</span>
          ) : null}
        </label>
      ) : null}
      <label>
        Name
        <input
          required
          value={form.name}
          onChange={set('name')}
          placeholder="Your name"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'inquiry-error-name' : undefined}
        />
        {fieldErrors.name ? <span id="inquiry-error-name" className="form-error">{fieldErrors.name}</span> : null}
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
          aria-describedby={fieldErrors.email ? 'inquiry-error-email' : undefined}
        />
        {fieldErrors.email ? <span id="inquiry-error-email" className="form-error">{fieldErrors.email}</span> : null}
      </label>
      <label>
        Contact number
        <PhonePhInput
          value={form.phone}
          onChange={setPhone}
          required={requirePhone}
          error={fieldErrors.phone}
          aria-describedby={fieldErrors.phone ? 'inquiry-error-phone' : undefined}
        />
        {fieldErrors.phone ? <span id="inquiry-error-phone" className="form-error">{fieldErrors.phone}</span> : null}
      </label>
      <label>
        Subject
        <input
          required
          value={form.subject}
          onChange={set('subject')}
          placeholder="How can we help?"
          aria-invalid={Boolean(fieldErrors.subject)}
          aria-describedby={fieldErrors.subject ? 'inquiry-error-subject' : undefined}
        />
        {fieldErrors.subject ? <span id="inquiry-error-subject" className="form-error">{fieldErrors.subject}</span> : null}
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
          aria-describedby={fieldErrors.message ? 'inquiry-error-message' : undefined}
        />
        {fieldErrors.message ? <span id="inquiry-error-message" className="form-error">{fieldErrors.message}</span> : null}
      </label>
      <div className="dx-inquiry-form__actions">
        <button type="submit" className="btn-dx-primary btn-sm" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-dx-secondary btn-sm" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default InquiryForm
