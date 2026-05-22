import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchDriverAssignments, uploadDocument } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'
import { enqueue } from '../../utils/offlineQueue'

const DOC_TYPES = [
  { value: 'pod',          label: 'Proof of Delivery (POD)' },
  { value: 'receipt',      label: 'Delivery Receipt' },
  { value: 'invoice',      label: 'Invoice' },
  { value: 'job_order',    label: 'Job Order' },
  { value: 'gate_pass',    label: 'Gate Pass' },
  { value: 'weighbridge',  label: 'Weighbridge Ticket' },
  { value: 'signed_doc',   label: 'Signed Document' },
  { value: 'other',        label: 'Other' },
]

function DocumentUploadPage() {
  const location = useNavigate ? useLocation() : {}
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const { pendingCount } = useSyncOnReconnect()

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

    if (!selectedId) {
      setError('Select an assignment first.')
      return
    }

    const file = fileRef.current?.files?.[0] ?? cameraRef.current?.files?.[0]
    if (!file) {
      setError('Please select or capture an image.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB for offline queue support.')
      return
    }

    setUploading(true)

    const uploadOnline = async () => {
      const fd = new FormData()
      fd.append('assignment_id', String(selectedId))
      fd.append('type', docType)
      fd.append('notes', notes)
      fd.append('file', file)
      const res = await uploadDocument(fd)
      setPreview(null)
      setFileName('')
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
      return res
    }

    try {
      if (!isOnline) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = String(reader.result || '')
            const comma = result.indexOf(',')
            resolve(comma >= 0 ? result.slice(comma + 1) : result)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        enqueue({
          type: 'document',
          payload: {
            assignment_id: Number(selectedId),
            type: docType,
            notes: notes || undefined,
            fileName: file.name,
            fileType: file.type,
            fileBase64: base64,
          },
        })
        setMessage(`Document queued offline (${pendingCount + 1} pending). Will upload when online.`)
        return
      }
      const res = await uploadOnline()
      const engine = res?.ocr_result?.engine
      const status = res?.ocr_result?.processing_status
      if (status === 'completed' && engine === 'tesseract') {
        setMessage('Document uploaded. OCR text extracted successfully.')
      } else if (status === 'completed' && engine === 'stub') {
        setMessage('Document uploaded. OCR stub mode — install Tesseract on server for real extraction.')
      } else if (status === 'failed') {
        setMessage('Document saved but OCR failed. Admin can reprocess from OCR Validation.')
      } else {
        setMessage('Document uploaded and queued for OCR processing.')
      }
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
          Offline — documents will queue and sync automatically when you reconnect.
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
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </form>
    </section>
  )
}

export default DocumentUploadPage
