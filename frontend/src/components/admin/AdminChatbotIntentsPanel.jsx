import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconPencil, IconTrash } from '../DxIcons'
import {
  createChatbotIntent,
  deleteChatbotIntent,
  fetchChatbotIntent,
  fetchChatbotIntents,
  updateChatbotIntent,
} from '../../api/admin'
import ChatbotIntentModal from './ChatbotIntentModal'
import ChatbotPaginatedTable from './ChatbotPaginatedTable'
import useConfirmation from '../../hooks/useConfirmation'

export default function AdminChatbotIntentsPanel() {
  const [intents, setIntents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intentSearch, setIntentSearch] = useState('')
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [modalIntent, setModalIntent] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const loadIntents = useCallback(async (search = intentSearch) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchChatbotIntents(search.trim())
      const rows = res?.data ?? []
      setIntents(rows)
      if (rows.length === 0) {
        setSelectedSlug(null)
        setSelectedDetail(null)
      } else if (!rows.some((r) => r.slug === selectedSlug)) {
        setSelectedSlug(rows[0].slug)
      }
    } catch (err) {
      setError(err?.message || 'Could not load intents.')
      setIntents([])
    } finally {
      setLoading(false)
    }
  }, [intentSearch, selectedSlug])

  useEffect(() => {
    loadIntents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const slug = selectedSlug
    if (!slug) {
      setSelectedDetail(null)
      return undefined
    }
    const row = intents.find((r) => r.slug === slug)
    if (!row?.id) return undefined

    let cancelled = false
    fetchChatbotIntent(row.id)
      .then((detail) => { if (!cancelled) setSelectedDetail(detail) })
      .catch(() => { if (!cancelled) setSelectedDetail(row) })

    return () => { cancelled = true }
  }, [selectedSlug, intents])

  const filteredIntents = useMemo(() => {
    const q = intentSearch.trim().toLowerCase()
    if (!q) return intents
    return intents.filter(
      (row) =>
        row.name?.toLowerCase().includes(q)
        || row.description?.toLowerCase().includes(q)
        || row.slug?.toLowerCase().includes(q),
    )
  }, [intents, intentSearch])

  const selectedIntent = selectedDetail
    || intents.find((row) => row.slug === selectedSlug)
    || filteredIntents[0]
    || null

  const training = selectedIntent?.training_phrases ?? []

  const openCreate = () => {
    setModalIntent(null)
    setModalOpen(true)
  }

  const openEdit = async (row, e) => {
    e?.stopPropagation()
    try {
      const detail = await fetchChatbotIntent(row.id)
      setModalIntent(detail)
      setModalOpen(true)
    } catch (err) {
      setError(err?.message || 'Could not load intent.')
    }
  }

  const handleDelete = (row, e) => {
    e?.stopPropagation()
    requestConfirmation({
      title: 'Delete intent?',
      message: `Remove "${row.name}" from the live assistant?`,
      detail: 'This cannot be undone. Training phrases and keyword rules for this intent will be deleted.',
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await deleteChatbotIntent(row.id)
        await loadIntents()
      },
    })
  }

  const handleSave = async (payload, id) => {
    if (id) {
      await updateChatbotIntent(id, payload)
    } else {
      await createChatbotIntent(payload)
    }
    await loadIntents()
  }

  return (
    <div className="dx-panel">
      {error ? <div className="form-error-banner" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="dx-intents-toolbar">
        <input
          type="search"
          placeholder="Search Intents..."
          value={intentSearch}
          onChange={(e) => setIntentSearch(e.target.value)}
          aria-label="Search intents"
        />
        <button type="button" className="btn-dx-primary" onClick={openCreate}>
          + New Intent
        </button>
      </div>

      <ChatbotPaginatedTable
        columns={['Intent Name', 'Description', 'Hits (7 days)', 'Resolution Rate', 'Owner', 'Actions']}
        rows={filteredIntents}
        pageResetKey={intentSearch}
        loading={loading}
        loadingMessage="Loading intents…"
        emptyMessage="No intents found. Create one to train the live assistant."
        renderRow={(row) => (
          <tr
            key={row.id}
            onClick={() => setSelectedSlug(row.slug)}
            style={{
              cursor: 'pointer',
              outline: selectedSlug === row.slug ? '2px solid rgba(45,84,183,0.35)' : 'none',
              outlineOffset: -2,
            }}
          >
            <td>
              {row.name}
              {!row.is_active ? (
                <span className="badge-dx badge-dx--draft" style={{ marginLeft: 8 }}>Inactive</span>
              ) : null}
            </td>
            <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{row.description || '—'}</td>
            <td>{row.hits ?? 0}</td>
            <td>{row.rate ?? 0}%</td>
            <td>{row.owner || '—'}</td>
            <td>
              <button
                type="button"
                className="dx-icon-btn"
                aria-label={`Edit ${row.name}`}
                title="Edit"
                onClick={(e) => openEdit(row, e)}
              >
                <IconPencil />
              </button>
              <button
                type="button"
                className="dx-icon-btn"
                aria-label={`Delete ${row.name}`}
                title="Delete"
                onClick={(e) => handleDelete(row, e)}
              >
                <IconTrash />
              </button>
            </td>
          </tr>
        )}
      />

      <div className="dx-train-phrases">
        <h4>Training phrases — {selectedIntent?.name ?? 'Select an intent'}</h4>
        {training.length > 0 ? (
          <ul>
            {training.map((phrase) => (
              <li key={phrase}>{phrase}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
            {selectedIntent ? 'No training phrases yet. Edit this intent to add examples.' : 'Select a row to view training phrases.'}
          </p>
        )}
        {selectedIntent?.answer ? (
          <>
            <h4 style={{ marginTop: 20 }}>Bot response preview</h4>
            <p className="dx-train-phrases__preview">{selectedIntent.answer}</p>
          </>
        ) : null}
      </div>

      {modalOpen ? (
        <ChatbotIntentModal
          intent={modalIntent}
          onClose={() => setModalOpen(false)}
          onSaved={handleSave}
        />
      ) : null}

      {confirmationModal}
    </div>
  )
}
