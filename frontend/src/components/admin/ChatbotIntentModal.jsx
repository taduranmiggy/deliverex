import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  owner: '',
  answer: '',
  training_phrases_text: '',
  keywords_text: '',
  is_active: true,
}

function slugifyName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseKeywords(text) {
  const keywords = {}
  parseLines(text).forEach((line) => {
    const [rawKey, rawWeight] = line.split(':').map((p) => p.trim())
    if (!rawKey) return
    const key = rawKey.toLowerCase()
    const weight = rawWeight && /^\d+$/.test(rawWeight) ? Number(rawWeight) : 2
    keywords[key] = Math.max(1, Math.min(10, weight))
  })
  return keywords
}

function keywordsToText(keywords) {
  if (!keywords || typeof keywords !== 'object') return ''
  return Object.entries(keywords)
    .map(([k, v]) => (v === 2 ? k : `${k}:${v}`))
    .join('\n')
}

function buildForm(intent) {
  if (!intent) return { ...EMPTY_FORM }
  return {
    name: intent.name ?? '',
    slug: intent.slug ?? '',
    description: intent.description ?? '',
    owner: intent.owner ?? '',
    answer: intent.answer ?? '',
    training_phrases_text: (intent.training_phrases ?? []).join('\n'),
    keywords_text: keywordsToText(intent.keywords),
    is_active: intent.is_active !== false,
  }
}

export default function ChatbotIntentModal({ intent, onClose, onSaved }) {
  const isEdit = Boolean(intent?.id)
  const [form, setForm] = useState(buildForm(intent))
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(buildForm(intent))
    setFieldErrors({})
    setError('')
  }, [intent])

  useEffect(() => {
    document.body.classList.add('dx-nav-locked')
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('dx-nav-locked')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, saving])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validate = () => {
    const errors = {}
    const name = String(form.name ?? '').trim()
    const answer = String(form.answer ?? '').trim()
    const phrases = parseLines(form.training_phrases_text)
    const slug = String(form.slug ?? '').trim()

    if (!name) errors.name = 'Intent name is required.'
    else if (name.length > 120) errors.name = 'Name must be 120 characters or less.'

    if (!answer) errors.answer = 'Bot response is required.'
    else if (answer.length > 5000) errors.answer = 'Response must be 5000 characters or less.'

    if (phrases.length === 0) errors.training_phrases_text = 'Add at least one training phrase (one per line).'
    else if (phrases.some((p) => p.length > 200)) errors.training_phrases_text = 'Each phrase must be 200 characters or less.'

    if (String(form.description ?? '').length > 500) errors.description = 'Description must be 500 characters or less.'
    if (String(form.owner ?? '').length > 120) errors.owner = 'Owner must be 120 characters or less.'

    if (slug && !/^[a-z0-9_]+$/.test(slug)) {
      errors.slug = 'Slug may only use lowercase letters, numbers, and underscores.'
    }

    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        owner: form.owner.trim() || null,
        answer: form.answer.trim(),
        training_phrases: parseLines(form.training_phrases_text),
        keywords: parseKeywords(form.keywords_text),
        is_active: form.is_active,
      }
      await onSaved(payload, isEdit ? intent.id : null)
      onClose()
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
      setError(err?.message || 'Could not save intent.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dx-modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="dx-modal dx-modal--wide" style={{ maxWidth: 640 }} onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dx-modal-header">
          <h2>{isEdit ? 'Edit Intent' : 'New Intent'}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 28px 28px' }}>
          {error ? <div className="form-error-banner">{error}</div> : null}

          <div className="form-grid">
            <label>
              Intent Name *
              <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Track Delivery" />
              {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
            </label>

            <label>
              Slug
              <input
                type="text"
                value={form.slug}
                onChange={set('slug')}
                placeholder={slugifyName(form.name) || 'track_delivery'}
              />
              <span className="field-hint">Leave blank to auto-generate from name.</span>
              {fieldErrors.slug ? <span className="field-error">{fieldErrors.slug}</span> : null}
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Description
              <input type="text" value={form.description} onChange={set('description')} placeholder="What this intent covers" />
              {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
            </label>

            <label>
              Owner
              <input type="text" value={form.owner} onChange={set('owner')} placeholder="e.g. Support Team" />
              {fieldErrors.owner ? <span className="field-error">{fieldErrors.owner}</span> : null}
            </label>

            <label className="dx-checkbox-label">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              Active (used by live assistant)
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Bot Response *
              <textarea
                rows={6}
                value={form.answer}
                onChange={set('answer')}
                placeholder="What the assistant should reply when this intent matches…"
              />
              {fieldErrors.answer ? <span className="field-error">{fieldErrors.answer}</span> : null}
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Training Phrases * <span className="field-hint">(one per line)</span>
              <textarea
                rows={5}
                value={form.training_phrases_text}
                onChange={set('training_phrases_text')}
                placeholder={'Saan yung delivery ko?\nWhere is my delivery?'}
              />
              {fieldErrors.training_phrases_text ? (
                <span className="field-error">{fieldErrors.training_phrases_text}</span>
              ) : null}
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Keywords <span className="field-hint">(optional — one per line, e.g. track:3)</span>
              <textarea
                rows={4}
                value={form.keywords_text}
                onChange={set('keywords_text')}
                placeholder={'track:3\ndelivery:2\nsaan:3'}
              />
            </label>
          </div>

          <div className="dx-modal-footer">
            <button type="button" className="btn-dx-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-dx-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Intent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
