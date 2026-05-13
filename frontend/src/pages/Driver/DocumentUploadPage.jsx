import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchDriverAssignments, uploadDocument } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'

const DOC_TYPES = [
  { value: 'pod',          label: 'Proof of Delivery (POD)' },
  { value: 'receipt',      label: 'Delivery Receipt' },
  { value: 'gate_pass',    label: 'Gate Pass' },
  { value: 'weighbridge',  label: 'Weighbridge Ticket' },
  { value: 'signed_doc',   label: 'Signed Document' },
  { value: 'other',        label: 'Other' },
]

function DocumentUploadPage() {
  const location = useNavigate ? useLocation() : {}
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const [assignments, setAssignments] = useState([])
  const [selectedId, setSelectedId] = useState(location.state?.assignmentId ?? '')
  const [docType, setDocType] = useState('pod')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const fileRef    = useRef(null)
  const cameraRef  = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchDriverAssignments(1)
        const active = (res.data || []).filter(
          (a) => !['completed', 'cancelled'].includes(a.status),
        )
        setAssignments(active)
        if (!selectedId && active.length > 0) {
          setSelectedId(active[0].id)
        }
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, []) // eslint-disable-line

  const handleFileChange = (file) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!isOnline) {
      setError('Document upload requires an internet connection.')
      return
    }

    if (!selectedId) {
      setError('Select an assignment first.')
      return
    }

    const file = fileRef.current?.files?.[0] ?? cameraRef.current?.files?.[0]
    if (!file) {
      setError('Please select or capture an image.')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('assignment_id', String(selectedId))
    fd.append('type',          docType)
    fd.append('notes',         notes)
    fd.append('file',          file)

    try {
      await uploadDocument(fd)
      setMessage('Document uploaded and queued for OCR processing.')
      setPreview(null)
      setFileName('')
      setNotes('')
      if (fileRef.current)   fileRef.current.value   = ''
      if (cameraRef.current) cameraRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="driver-page">
      <button type="button" className="driver-back-btn" onClick={() => navigate('/driver')}>
        ← Back
      </button>
      <header className="driver-page-header">
        <h1>Upload Document</h1>
        <p className="driver-page-sub">Attach proof of delivery, receipts, and gate passes.</p>
      </header>

      {!isOnline && (
        <div className="driver-offline-banner">
          Offline — uploads require a connection.
        </div>
      )}

      <form className="driver-form-card" onSubmit={handleSubmit}>
        {/* Assignment selector */}
        <div className="driver-field">
          <label htmlFor="dx-doc-assign">Assignment</label>
          <select
            id="dx-doc-assign"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            required
          >
            <option value="">— Select assignment —</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} · {a.job_order?.pickup_location ?? '?'} → {a.job_order?.dropoff_location ?? '?'}
              </option>
            ))}
          </select>
        </div>

        {/* Document type */}
        <div className="driver-field">
          <label htmlFor="dx-doc-type">Document type</label>
          <select
            id="dx-doc-type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Camera capture (primary for PWA) */}
        <div className="driver-field">
          <label>Take photo (camera)</label>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            className="driver-file-input"
          />
        </div>

        {/* File picker fallback */}
        <div className="driver-field">
          <label>Or choose from files</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={(e) => {
              handleFileChange(e.target.files?.[0])
              if (cameraRef.current) cameraRef.current.value = ''
            }}
            className="driver-file-input"
          />
          {fileName && <span className="driver-file-name">{fileName}</span>}
        </div>

        {/* Image preview */}
        {preview && (
          <div className="driver-preview-wrap">
            <img src={preview} alt="Preview" className="driver-preview-img" />
            <button
              type="button"
              className="driver-preview-remove"
              onClick={() => {
                setPreview(null)
                setFileName('')
                if (fileRef.current)   fileRef.current.value   = ''
                if (cameraRef.current) cameraRef.current.value = ''
              }}
            >
              Remove
            </button>
          </div>
        )}

        {/* Notes */}
        <div className="driver-field">
          <label htmlFor="dx-doc-notes">Notes (optional)</label>
          <textarea
            id="dx-doc-notes"
            rows={2}
            placeholder="Any document-specific remarks…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {message && <p className="driver-success">{message}</p>}
        {error   && <p className="driver-error">{error}</p>}

        <button
          type="submit"
          className="driver-btn-primary driver-btn-full"
          disabled={uploading || !isOnline}
        >
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </form>
    </section>
  )
}

export default DocumentUploadPage
