import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import { useDriverUi } from '../../context/DriverUiContext'
import { fetchDriverAssignments, uploadDocumentWithProgress } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'
import { enqueue } from '../../utils/offlineQueue'
import { Camera, Loader2, Upload } from 'lucide-react'

const DOC_TYPES = [
  { value: 'receipt', label: 'Delivery Receipt' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'pod', label: 'Proof of Delivery' },
  { value: 'job_order', label: 'Job Order' },
  { value: 'other', label: 'Other' },
]

function DocumentUploadPage() {
  const location = useLocation()
  const { showToast } = useDriverUi()
  const isOnline = useOnlineStatus()
  const { pendingCount } = useSyncOnReconnect()

  const [assignments, setAssignments] = useState([])
  const [selectedId, setSelectedId] = useState(location.state?.assignmentId ?? '')
  const [docType, setDocType] = useState('pod')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState(null)

  const fileRef = useRef(null)
  const cameraRef = useRef(null)

  useEffect(() => {
    fetchDriverAssignments(1)
      .then((res) => {
        const active = (res.data || []).filter((a) => !['completed', 'cancelled'].includes(a.status))
        setAssignments(active)
        if (!selectedId && active.length > 0) setSelectedId(String(active[0].id))
      })
      .catch((err) => setError(err.message))
  }, []) // eslint-disable-line

  const clearFile = () => {
    setPreview(null)
    setFileName('')
    setOcrStatus(null)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
  const ALLOWED_EXT = ['.jpg', '.jpeg', '.png']

  const validateFile = (file) => {
    if (!file) return 'Please capture or upload an image first.'
    const ext = file.name?.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      return 'Only JPG, JPEG, and PNG images are supported for OCR.'
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'Image must be under 10 MB.'
    }
    if (!isOnline && file.size > 2 * 1024 * 1024) {
      return 'Image must be under 2 MB for offline queue support.'
    }
    return null
  }

  const handleFileChange = (file) => {
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      clearFile()
      return
    }
    setFileName(file.name)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setOcrStatus(null)

    if (!selectedId) {
      setError('Select an assignment first.')
      return
    }

    const file = fileRef.current?.files?.[0] ?? cameraRef.current?.files?.[0]
    const fileError = validateFile(file)
    if (fileError) {
      setError(fileError)
      return
    }

    setUploading(true)
    setUploadProgress(0)

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
        showToast(`Document queued (${pendingCount + 1} pending sync)`)
        clearFile()
        return
      }

      const fd = new FormData()
      fd.append('assignment_id', String(selectedId))
      fd.append('type', docType)
      fd.append('notes', notes)
      fd.append('file', file)
      const res = await uploadDocumentWithProgress(fd, setUploadProgress)
      setUploadProgress(100)

      const ocr = res?.ocr_result
      const status = ocr?.processing_status
      if (status === 'failed') {
        setOcrStatus('failed')
        setError(ocr?.error_message || 'OCR processing failed on the server.')
        showToast('Upload saved but OCR failed', 'error')
      } else if (status === 'validated') {
        setOcrStatus('validated')
        showToast('Document submitted — OCR validated')
      } else if (status === 'needs_review') {
        setOcrStatus('processing')
        showToast('Document submitted — OCR needs admin review')
      } else if (['processed', 'completed'].includes(status)) {
        setOcrStatus('validated')
        showToast('Document submitted — OCR processed')
      } else if (status === 'processing' || status === 'pending') {
        setOcrStatus('processing')
        showToast('Document submitted — OCR processing')
      } else {
        showToast('Document submitted successfully')
      }
      clearFile()
    } catch (err) {
      setError(err.message || 'Document upload failed. Please try again.')
      showToast('Upload failed', 'error')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 800)
    }
  }

  return (
    <>
      <DriverOfflineBar />

      {!isOnline && (
        <p className="da-alert" style={{ background: '#fef3c7', color: '#92400e' }}>
          Offline — documents will queue and sync when you reconnect.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {assignments.length > 1 && (
          <div className="da-field">
            <label>Assignment</label>
            <div className="da-chip-row">
              {assignments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`da-type-chip${String(a.id) === String(selectedId) ? ' da-type-chip--on' : ''}`}
                  onClick={() => setSelectedId(String(a.id))}
                >
                  #{a.id}
                </button>
              ))}
            </div>
          </div>
        )}

        {assignments.length === 1 && selectedId && (
          <div className="da-card" style={{ marginBottom: 16 }}>
            <p className="da-card__label">Assignment</p>
            <p style={{ fontWeight: 700, margin: 0 }}>Job #{selectedId}</p>
          </div>
        )}

        <p className="da-section-head">Add image</p>
        <div className="da-upload-grid">
          <button type="button" className="da-upload-tile" onClick={() => cameraRef.current?.click()}>
            <Camera size={24} />
            Take Photo
          </button>
          <button type="button" className="da-upload-tile" onClick={() => fileRef.current?.click()}>
            <Upload size={24} />
            Upload from Device
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden
          className="driver-file-input-hidden"
          onChange={(e) => {
            if (fileRef.current) fileRef.current.value = ''
            handleFileChange(e.target.files?.[0])
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          tabIndex={-1}
          aria-hidden
          className="driver-file-input-hidden"
          onChange={(e) => {
            if (cameraRef.current) cameraRef.current.value = ''
            handleFileChange(e.target.files?.[0])
          }}
        />

        {preview && (
          <div className="da-preview">
            <img src={preview} alt="Preview" />
            <button type="button" className="da-preview__remove" onClick={clearFile}>Remove</button>
          </div>
        )}
        {fileName && !preview && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', marginBottom: 12 }}>Selected: {fileName}</p>
        )}

        <p className="da-section-head">Document type</p>
        <div className="da-chip-row">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`da-type-chip${docType === t.value ? ' da-type-chip--on' : ''}`}
              onClick={() => setDocType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="da-field">
          <label htmlFor="doc-notes">Notes (optional)</label>
          <textarea
            id="doc-notes"
            rows={2}
            placeholder="Any remarks about this document…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="da-alert da-alert--error">{error}</p>}

        {uploading && (
          <div aria-live="polite">
            <div className="da-progress">
              <div className="da-progress__bar" style={{ width: `${Math.max(uploadProgress, 8)}%` }} />
            </div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--da-muted)', textAlign: 'center' }}>
              {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Processing document…'}
            </p>
          </div>
        )}

        {ocrStatus === 'processing' && (
          <div className="da-ocr-badge"><Loader2 size={14} className="driver-spin" /> OCR processing…</div>
        )}
        {ocrStatus === 'validated' && (
          <div className="da-ocr-badge" style={{ background: '#d1fae5', color: '#047857' }}>OCR validated</div>
        )}
        {ocrStatus === 'failed' && (
          <div className="da-ocr-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>OCR failed — admin can reprocess</div>
        )}

        <button type="submit" className="da-btn da-btn--primary da-btn--lg da-btn--block" disabled={uploading} style={{ marginTop: 8 }}>
          {uploading ? 'Submitting…' : 'Submit Document'}
        </button>
      </form>
    </>
  )
}

export default DocumentUploadPage
