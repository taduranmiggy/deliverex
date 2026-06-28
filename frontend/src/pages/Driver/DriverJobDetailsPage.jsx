import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BottomSheet from '../../components/driver/BottomSheet'
import DeliveryTimeline from '../../components/driver/DeliveryTimeline'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import DriverStatusChip from '../../components/driver/DriverStatusChip'
import { useDriverUi } from '../../context/DriverUiContext'
import {
  fetchDriverAssignment,
  postDelayReport,
  uploadIssueReport,
  postStatusUpdate,
  uploadCompletionProof,
  uploadDocument,
} from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import { enqueue } from '../../utils/offlineQueue'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import {
  DELAY_REASONS,
  formatJobSchedule,
  formatLastUpdated,
  getNextStatusOptions,
  ISSUE_TYPES,
} from '../../utils/driverAssignment'
import {
  AlertTriangle,
  Camera,
  Car,
  ClipboardList,
  Clock,
  Crosshair,
  ExternalLink,
  FileUp,
  Loader2,
  MapPin,
  Navigation,
  User,
  X,
} from 'lucide-react'

const STATUS_META = {
  en_route_to_pickup: {
    label: 'Start Pickup',
    confirmTitle: 'Start trip?',
    confirmSub: 'Capture your GPS location to start the trip toward pickup. A departure photo is optional.',
  },
  arrived_at_pickup: {
    label: 'Mark Pickup Arrived',
    confirmTitle: 'Confirm pickup arrival?',
    confirmSub: 'Confirm you have arrived at the pickup point.',
  },
  en_route_to_destination: {
    label: 'Start Delivery',
    confirmTitle: 'Start delivery?',
    confirmSub: 'Proceed from pickup to the delivery destination.',
  },
  arrived: {
    label: 'Mark Arrived at Destination',
    confirmTitle: 'Confirm arrival?',
    confirmSub: 'Capture your GPS location to verify you are at the delivery destination (within 300 m).',
  },
  completed: {
    label: 'Complete Delivery',
    confirmTitle: 'Complete delivery?',
    confirmSub: 'Upload delivery proof (receipt photo or OCR document) before completing. Receiver details are optional.',
  },
}

function DriverJobDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useDriverUi()
  const isOnline = useOnlineStatus()

  const [assignment, setAssignment] = useState(null)
  const [error, setError] = useState('')
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsState, setGpsState] = useState('idle')
  const [gpsError, setGpsError] = useState('')
  const [departureFile, setDepartureFile] = useState(null)
  const [departurePreview, setDeparturePreview] = useState('')
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueType, setIssueType] = useState('')
  const [issueNotes, setIssueNotes] = useState('')
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [issuePhoto, setIssuePhoto] = useState(null)
  const [issuePhotoPreview, setIssuePhotoPreview] = useState('')
  const [delayOpen, setDelayOpen] = useState(false)
  const [delayReason, setDelayReason] = useState('')
  const [delayNotes, setDelayNotes] = useState('')
  const [delaySubmitting, setDelaySubmitting] = useState(false)
  const [delayError, setDelayError] = useState('')
  const [proofType, setProofType] = useState('receipt_photo')
  const [ocrDocType, setOcrDocType] = useState('receipt')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState('')
  const [signatureFile, setSignatureFile] = useState(null)
  const [signaturePreview, setSignaturePreview] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [receiverContact, setReceiverContact] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [proofError, setProofError] = useState('')

  const load = useCallback(() => {
    if (!id) return
    fetchDriverAssignment(id)
      .then((res) => setAssignment(res))
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (location.state?.reportIssue) setIssueOpen(true)
  }, [location.state?.reportIssue])

  const job = assignment?.job_order
  const logs = [...(assignment?.delivery_status_logs ?? [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  )
  const isActive = assignment && !['completed', 'cancelled'].includes(assignment.status)
  const latestGps = [...(assignment?.tracking_logs ?? [])].sort(
    (a, b) => new Date(b.captured_at) - new Date(a.captured_at),
  )[0]
  const dropoff = buildDisplayAddress('dropoff', job) || job?.dropoff_location || ''
  const dropoffLat = Number(job?.dropoff_latitude)
  const dropoffLng = Number(job?.dropoff_longitude)
  const hasDropoffCoords = Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)
  const navUrl = hasDropoffCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${dropoffLat},${dropoffLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff)}`
  const wazeUrl = hasDropoffCoords
    ? `https://waze.com/ul?ll=${dropoffLat},${dropoffLng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(dropoff)}&navigate=yes`

  const lastUpdated = formatLastUpdated(assignment)
  const nextStatuses = assignment ? getNextStatusOptions(assignment.status) : []
  const deliveryNotes = [job?.notes, job?.job_requirements].filter(Boolean)
  const primaryNext = nextStatuses[0]

  // Start Trip / Arrival Verification: GPS proof required for these transitions.
  const isStartTrip = pendingStatus === 'en_route_to_pickup' && assignment?.status === 'assigned'
  const isArrivalVerify = pendingStatus === 'arrived' && assignment?.status === 'en_route_to_destination'
  const isCompleteProof = pendingStatus === 'completed' && assignment?.status === 'arrived'
  const needsGpsProof = isStartTrip || isArrivalVerify
  const hasExistingProof = Boolean(assignment?.completion_proof)

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('error')
      setGpsError('Geolocation is not supported on this device.')
      return
    }
    setGpsState('locating')
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGpsState('ready')
      },
      (err) => {
        setGpsState('error')
        setGpsError(err.message || 'Unable to get your location. Enable location and retry.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  // Auto-capture GPS when start-trip or arrival verification sheet opens.
  useEffect(() => {
    if (needsGpsProof && gpsState === 'idle') captureGps()
  }, [needsGpsProof, gpsState, captureGps])

  const resetStartTrip = () => {
    setGpsCoords(null)
    setGpsState('idle')
    setGpsError('')
    setDepartureFile(null)
    setDeparturePreview('')
    setProofType('receipt_photo')
    setOcrDocType('receipt')
    setProofFile(null)
    setProofPreview('')
    setSignatureFile(null)
    setSignaturePreview('')
    setReceiverName('')
    setReceiverContact('')
    setCompletionNotes('')
    setProofError('')
  }

  const closeStatusSheet = () => {
    if (statusSubmitting) return
    setPendingStatus(null)
    resetStartTrip()
  }

  const handleDepartureFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setDepartureFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setDeparturePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleProofFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setProofError('')
    const reader = new FileReader()
    reader.onload = (e) => setProofPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSignatureFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSignatureFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setSignaturePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const buildCompletionProofFormData = () => {
    const fd = new FormData()
    fd.append('assignment_id', String(assignment.id))
    fd.append('proof_type', proofType)
    if (proofType === 'ocr_document') fd.append('document_type', ocrDocType)
    if (receiverName.trim()) fd.append('receiver_name', receiverName.trim())
    if (receiverContact.trim()) fd.append('receiver_contact', receiverContact.trim())
    if (completionNotes.trim()) fd.append('delivery_notes', completionNotes.trim())
    fd.append('file', proofFile, proofFile.name)
    if (signatureFile) fd.append('signature', signatureFile, signatureFile.name)
    return fd
  }

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const confirmStatus = async () => {
    if (!assignment || !pendingStatus || statusSubmitting) return

    if (needsGpsProof && !gpsCoords) {
      setGpsError(isArrivalVerify
        ? 'GPS location is required to confirm arrival.'
        : 'GPS location is required to start the trip.')
      if (gpsState !== 'locating') captureGps()
      return
    }

    if (isCompleteProof && !hasExistingProof && !proofFile) {
      setProofError('Upload delivery proof (receipt photo or document) before completing.')
      return
    }

    // Capture the action timestamp before any async work (preserves original timing)
    const actionTs = new Date().toISOString()

    setStatusSubmitting(true)
    try {
      const statusPayload = { assignment_id: assignment.id, status: pendingStatus }
      if (needsGpsProof && gpsCoords) {
        statusPayload.latitude = gpsCoords.latitude
        statusPayload.longitude = gpsCoords.longitude
      }

      if (!isOnline && (needsGpsProof || isCompleteProof)) {
        if (isCompleteProof && !hasExistingProof && proofFile) {
          const fileBase64 = await readFileAsBase64(proofFile)
          const proofPayload = {
            assignment_id: assignment.id,
            proof_type: proofType,
            document_type: proofType === 'ocr_document' ? ocrDocType : undefined,
            receiver_name: receiverName.trim() || undefined,
            receiver_contact: receiverContact.trim() || undefined,
            delivery_notes: completionNotes.trim() || undefined,
            fileName: proofFile.name,
            fileType: proofFile.type,
            fileBase64,
          }
          if (signatureFile) {
            proofPayload.signatureBase64 = await readFileAsBase64(signatureFile)
            proofPayload.signatureName = signatureFile.name
            proofPayload.signatureType = signatureFile.type
          }
          enqueue({ type: 'completion_proof', payload: proofPayload, action_timestamp: actionTs })
        }
        if (departureFile) {
          const fileBase64 = await readFileAsBase64(departureFile)
          enqueue({
            type: 'document',
            payload: {
              assignment_id: assignment.id,
              type: 'departure',
              notes: 'Departure photo',
              fileName: departureFile.name,
              fileType: departureFile.type,
              fileBase64,
            },
            action_timestamp: actionTs,
          })
        }
        enqueue({ type: 'status', payload: statusPayload, action_timestamp: actionTs })
        const offlineMsg = isCompleteProof
          ? 'Completion proof and status queued — will sync when online'
          : isArrivalVerify
            ? 'Arrival queued — will sync when online'
            : 'Trip start queued — will sync when online'
        showToast(offlineMsg)
        closeStatusSheet()
        return
      }

      if (isCompleteProof && !hasExistingProof && proofFile) {
        await uploadCompletionProof(buildCompletionProofFormData())
      }

      if (isStartTrip && departureFile) {
        const fd = new FormData()
        fd.append('assignment_id', String(assignment.id))
        fd.append('type', 'departure')
        fd.append('notes', 'Departure photo')
        fd.append('file', departureFile, departureFile.name)
        await uploadDocument(fd)
      }

      await postStatusUpdate(statusPayload)
      showToast('Status updated successfully')
      setPendingStatus(null)
      resetStartTrip()
      load()
    } catch (err) {
      showToast(err.message || 'Unable to update status', 'error')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const handleIssuePhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIssuePhoto(file)
    const reader = new FileReader()
    reader.onload = (e) => setIssuePhotoPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const submitIssue = async () => {
    if (!issueType) {
      setIssueError('Select an issue type.')
      return
    }
    const actionTs = new Date().toISOString()
    setIssueSubmitting(true)
    setIssueError('')
    try {
      if (!isOnline) {
        const payload = {
          assignment_id: assignment.id,
          issue_type: issueType,
          notes: issueNotes.trim() || undefined,
        }
        if (issuePhoto) {
          payload.fileBase64 = await readFileAsBase64(issuePhoto)
          payload.fileName = issuePhoto.name
          payload.fileType = issuePhoto.type
        }
        enqueue({ type: 'issue', payload, action_timestamp: actionTs })
        showToast('Issue report queued — will sync when online')
      } else {
        const fd = new FormData()
        fd.append('assignment_id', String(assignment.id))
        fd.append('issue_type', issueType)
        if (issueNotes.trim()) fd.append('notes', issueNotes.trim())
        if (issuePhoto) fd.append('photo', issuePhoto, issuePhoto.name)
        await uploadIssueReport(fd)
        showToast('Issue report submitted')
      }
      setIssueOpen(false)
      setIssueType('')
      setIssueNotes('')
      setIssuePhoto(null)
      setIssuePhotoPreview('')
    } catch (err) {
      setIssueError(err.message || 'Unable to submit issue report.')
    } finally {
      setIssueSubmitting(false)
    }
  }

  const submitDelay = async () => {
    if (!delayReason) {
      setDelayError('Select a delay reason.')
      return
    }
    if (delayReason === 'other' && !delayNotes.trim()) {
      setDelayError('Notes are required when selecting Other.')
      return
    }
    const actionTs = new Date().toISOString()
    setDelaySubmitting(true)
    setDelayError('')
    const payload = {
      assignment_id: assignment.id,
      delay_reason: delayReason,
      delay_notes: delayNotes.trim() || undefined,
    }
    try {
      if (!isOnline) {
        enqueue({ type: 'delay', payload, action_timestamp: actionTs })
        showToast('Delay report queued — will sync when online')
      } else {
        await postDelayReport(payload)
        showToast('Delay report submitted')
      }
      setDelayOpen(false)
      setDelayReason('')
      setDelayNotes('')
    } catch (err) {
      setDelayError(err.message || 'Unable to submit delay report.')
    } finally {
      setDelaySubmitting(false)
    }
  }

  if (!assignment && !error) {
    return (
      <>
        <DriverOfflineBar />
        <div className="da-skeleton" style={{ minHeight: 200 }} />
      </>
    )
  }

  return (
    <>
      <DriverOfflineBar />
      {error && <p className="da-alert da-alert--error">{error}</p>}

      {assignment && (
        <>
          <div className="da-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--da-muted)' }}>
                {formatJobPublicId(assignment.job_order_id)}
              </span>
              <DriverStatusChip status={assignment.status} />
            </div>
            {lastUpdated && (
              <p style={{ fontSize: '0.75rem', color: 'var(--da-muted)', margin: '0 0 14px' }}>
                Last updated {lastUpdated}
              </p>
            )}
            <DeliveryTimeline status={assignment.status} />
          </div>

          {(buildDisplayName(job) || job?.customer_name) && (
            <div className="da-card">
              <p className="da-card__label">Client</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#eff6ff', display: 'grid', placeItems: 'center' }}>
                  <User size={20} color="var(--da-primary)" />
                </div>
                <div>
                  <p style={{ fontWeight: 800, margin: 0, fontSize: '1rem' }}>{buildDisplayName(job) || job.customer_name}</p>
                  {job.customer_contact && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: '2px 0 0' }}>{job.customer_contact}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="da-card">
            <p className="da-card__label"><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />Route</p>
            <div className="da-kv"><span>Pickup</span><strong>{buildDisplayAddress('pickup', job) || '—'}</strong></div>
            <div className="da-kv"><span>Drop-off</span><strong>{buildDisplayAddress('dropoff', job) || '—'}</strong></div>
            <div className="da-kv"><span>Schedule</span><strong>{formatJobSchedule(job)}</strong></div>
            {job?.tracking_code && (
              <div className="da-kv"><span>Tracking</span><strong style={{ fontFamily: 'monospace' }}>{job.tracking_code}</strong></div>
            )}
          </div>

          {isActive && (
            <div className="da-nav-card">
              <p className="da-card__label" style={{ color: 'var(--da-primary)' }}>
                <Navigation size={12} style={{ display: 'inline', marginRight: 4 }} />
                Navigation
              </p>
              <p className="da-nav-card__dest">{dropoff || 'Destination not set'}</p>
              {latestGps && (
                <p style={{ fontSize: '0.75rem', color: 'var(--da-muted)', margin: '0 0 12px' }}>
                  Last known: {Number(latestGps.latitude).toFixed(4)}, {Number(latestGps.longitude).toFixed(4)}
                </p>
              )}
              <div className="da-nav-grid">
                <a href={navUrl} target="_blank" rel="noopener noreferrer" className="da-btn da-btn--maps">
                  <ExternalLink size={16} /> Google Maps
                </a>
                <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="da-btn da-btn--waze">
                  <ExternalLink size={16} /> Waze
                </a>
              </div>
            </div>
          )}

          {assignment.vehicle && (
            <div className="da-card">
              <p className="da-card__label"><Car size={12} style={{ display: 'inline', marginRight: 4 }} />Vehicle</p>
              <div className="da-kv"><span>Plate</span><strong style={{ fontFamily: 'monospace' }}>{assignment.vehicle.plate_no}</strong></div>
              <div className="da-kv"><span>Type</span><strong>{assignment.vehicle.type ?? '—'}</strong></div>
            </div>
          )}

          <div className="da-card">
            <p className="da-card__label"><ClipboardList size={12} style={{ display: 'inline', marginRight: 4 }} />Delivery notes</p>
            {deliveryNotes.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem', lineHeight: 1.5 }}>
                {deliveryNotes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            ) : (
              <p style={{ margin: 0, color: 'var(--da-muted)', fontSize: '0.875rem' }}>No delivery notes.</p>
            )}
          </div>

          {logs.length > 0 && (
            <div className="da-card">
              <p className="da-card__label">Status history</p>
              {logs.map((log, i) => (
                <div key={i} className="da-kv" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</span>
                    <DriverStatusChip status={log.status} />
                  </div>
                  {log.status === 'arrived' && log.arrival_verified && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                      GPS Verified
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isActive && (
            <div className="da-job-footer">
              {primaryNext && (
                <button
                  type="button"
                  className="da-btn da-btn--primary da-btn--lg da-btn--block"
                  disabled={statusSubmitting}
                  onClick={() => setPendingStatus(primaryNext.value)}
                >
                  {STATUS_META[primaryNext.value]?.label ?? primaryNext.label}
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="da-btn da-btn--secondary"
                  onClick={() => navigate('/driver/documents', { state: { assignmentId: assignment.id } })}
                >
                  <FileUp size={16} /> Upload Proof
                </button>
                <button type="button" className="da-btn da-btn--outline" onClick={() => setIssueOpen(true)}>
                  <AlertTriangle size={16} /> Report Issue
                </button>
              </div>
              <button type="button" className="da-btn da-btn--outline da-btn--block" onClick={() => setDelayOpen(true)}>
                <Clock size={16} /> Report Delay
              </button>
            </div>
          )}

          <div style={{ height: isActive ? 168 : 0 }} aria-hidden />

          <BottomSheet
            open={!!pendingStatus}
            onClose={closeStatusSheet}
            title={STATUS_META[pendingStatus]?.confirmTitle ?? 'Update status?'}
            subtitle={STATUS_META[pendingStatus]?.confirmSub}
            footer={(
              <>
                <button
                  type="button"
                  className="da-btn da-btn--primary da-btn--block"
                  disabled={statusSubmitting || (needsGpsProof && !gpsCoords) || (isCompleteProof && !hasExistingProof && !proofFile)}
                  onClick={confirmStatus}
                >
                  {statusSubmitting
                    ? 'Saving…'
                    : isStartTrip
                      ? 'Start Trip'
                      : pendingStatus === 'arrived_at_pickup'
                        ? 'Confirm Pickup Arrival'
                        : pendingStatus === 'en_route_to_destination'
                          ? 'Start Delivery'
                          : isArrivalVerify
                            ? 'Confirm Arrival'
                            : isCompleteProof
                              ? 'Submit Proof & Complete'
                              : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="da-btn da-btn--secondary da-btn--block"
                  disabled={statusSubmitting}
                  onClick={closeStatusSheet}
                >
                  Cancel
                </button>
              </>
            )}
          >
            {needsGpsProof && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                <div style={{ background: 'var(--da-surface-2, #f8fafc)', border: '1px solid var(--da-border, #e2e8f0)', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {gpsState === 'locating'
                      ? <Loader2 size={18} color="var(--da-primary)" style={{ animation: 'da-spin 0.8s linear infinite' }} />
                      : <Crosshair size={18} color={gpsCoords ? '#16a34a' : 'var(--da-muted)'} />}
                    <strong style={{ fontSize: '0.9375rem' }}>
                      {gpsState === 'locating' ? 'Capturing GPS location…'
                        : gpsCoords ? (isArrivalVerify ? 'GPS ready for arrival check' : 'GPS location captured')
                          : 'GPS location required'}
                    </strong>
                  </div>
                  {gpsCoords && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: '6px 0 0', fontFamily: 'monospace' }}>
                      {Number(gpsCoords.latitude).toFixed(5)}, {Number(gpsCoords.longitude).toFixed(5)}
                    </p>
                  )}
                  {gpsError && <p className="da-alert da-alert--error" style={{ marginTop: 8 }}>{gpsError}</p>}
                  {gpsState !== 'locating' && (
                    <button
                      type="button"
                      className="da-btn da-btn--outline"
                      style={{ marginTop: 10 }}
                      onClick={captureGps}
                    >
                      <Crosshair size={15} /> {gpsCoords ? 'Recapture location' : 'Capture location'}
                    </button>
                  )}
                </div>

                {isStartTrip && (
                <div className="da-field">
                  <label htmlFor="departure-photo" style={{ display: 'block', marginBottom: 6 }}>
                    Departure photo (optional)
                  </label>
                  {departurePreview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={departurePreview}
                        alt="Departure"
                        style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12 }}
                      />
                      <button
                        type="button"
                        aria-label="Remove departure photo"
                        onClick={() => { setDepartureFile(null); setDeparturePreview('') }}
                        style={{
                          position: 'absolute', top: 8, right: 8, border: 'none', borderRadius: '50%',
                          width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer',
                          display: 'grid', placeItems: 'center',
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="da-btn da-btn--secondary da-btn--block" style={{ cursor: 'pointer' }}>
                      <Camera size={16} /> Add departure photo
                      <input
                        id="departure-photo"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleDepartureFile}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
                )}
              </div>
            )}

            {isCompleteProof && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                {hasExistingProof ? (
                  <p className="da-alert" style={{ background: '#f0fdf4', color: '#166534', margin: 0 }}>
                    Completion proof already submitted. You can mark this delivery as completed.
                  </p>
                ) : (
                  <>
                    <div className="da-chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        className={`da-type-chip${proofType === 'receipt_photo' ? ' da-type-chip--on' : ''}`}
                        onClick={() => setProofType('receipt_photo')}
                      >
                        Receipt Photo
                      </button>
                      <button
                        type="button"
                        className={`da-type-chip${proofType === 'ocr_document' ? ' da-type-chip--on' : ''}`}
                        onClick={() => setProofType('ocr_document')}
                      >
                        OCR Document
                      </button>
                    </div>

                    {proofType === 'ocr_document' && (
                      <div className="da-chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          { value: 'receipt', label: 'Receipt' },
                          { value: 'pod', label: 'POD' },
                          { value: 'signed_doc', label: 'Signed Doc' },
                          { value: 'invoice', label: 'Invoice' },
                        ].map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            className={`da-type-chip${ocrDocType === t.value ? ' da-type-chip--on' : ''}`}
                            onClick={() => setOcrDocType(t.value)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className="da-btn da-btn--secondary da-btn--block" style={{ cursor: 'pointer' }}>
                      <Camera size={16} /> {proofPreview ? 'Change proof photo' : 'Capture / upload proof'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleProofFile}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {proofPreview && (
                      <img
                        src={proofPreview}
                        alt="Proof preview"
                        style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }}
                      />
                    )}

                    <div className="da-field">
                      <label htmlFor="receiver-name">Receiver name (optional)</label>
                      <input
                        id="receiver-name"
                        type="text"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Who received the delivery?"
                      />
                    </div>
                    <div className="da-field">
                      <label htmlFor="receiver-contact">Receiver contact (optional)</label>
                      <input
                        id="receiver-contact"
                        type="tel"
                        value={receiverContact}
                        onChange={(e) => setReceiverContact(e.target.value)}
                        placeholder="Mobile number"
                      />
                    </div>
                    <div className="da-field">
                      <label htmlFor="completion-notes">Delivery notes (optional)</label>
                      <textarea
                        id="completion-notes"
                        rows={2}
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder="Any remarks about the delivery…"
                      />
                    </div>
                    <div className="da-field">
                      <label htmlFor="receiver-signature">Receiver signature (optional)</label>
                      <label className="da-btn da-btn--outline da-btn--block" style={{ cursor: 'pointer', marginTop: 6 }}>
                        <Camera size={16} /> {signaturePreview ? 'Change signature' : 'Capture signature'}
                        <input
                          id="receiver-signature"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleSignatureFile}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {signaturePreview && (
                        <img
                          src={signaturePreview}
                          alt="Signature preview"
                          style={{ width: '100%', maxHeight: 100, objectFit: 'contain', borderRadius: 8, marginTop: 8, background: '#fff' }}
                        />
                      )}
                    </div>
                    {proofError && <p className="da-alert da-alert--error">{proofError}</p>}
                  </>
                )}
              </div>
            )}
          </BottomSheet>

          <BottomSheet
            open={issueOpen}
            onClose={() => !issueSubmitting && setIssueOpen(false)}
            title="Report Issue"
            subtitle="Select the issue category, add notes, and optionally attach a photo."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ISSUE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`da-issue-option${issueType === t.value ? ' da-issue-option--selected' : ''}`}
                  onClick={() => setIssueType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="da-field" style={{ marginTop: 16 }}>
              <label htmlFor="issue-notes">Notes (optional)</label>
              <textarea
                id="issue-notes"
                rows={3}
                placeholder="Describe the issue…"
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
              />
            </div>
            <div className="da-field">
              <label htmlFor="issue-photo">Photo (optional)</label>
              {issuePhotoPreview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={issuePhotoPreview}
                    alt="Issue"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }}
                  />
                  <button
                    type="button"
                    aria-label="Remove issue photo"
                    onClick={() => { setIssuePhoto(null); setIssuePhotoPreview('') }}
                    style={{
                      position: 'absolute', top: 8, right: 8, border: 'none', borderRadius: '50%',
                      width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="da-btn da-btn--secondary da-btn--block" style={{ cursor: 'pointer' }}>
                  <Camera size={16} /> Add photo
                  <input
                    id="issue-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleIssuePhoto}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
            {issueError && <p className="da-alert da-alert--error">{issueError}</p>}
            <div className="da-sheet__actions">
              <button
                type="button"
                className="da-btn da-btn--primary da-btn--block"
                disabled={issueSubmitting}
                onClick={submitIssue}
              >
                {issueSubmitting ? 'Submitting…' : 'Submit Issue Report'}
              </button>
              <button
                type="button"
                className="da-btn da-btn--secondary da-btn--block"
                disabled={issueSubmitting}
                onClick={() => setIssueOpen(false)}
              >
                Cancel
              </button>
            </div>
          </BottomSheet>

          <BottomSheet
            open={delayOpen}
            onClose={() => !delaySubmitting && setDelayOpen(false)}
            title="Report Delay"
            subtitle="Select the reason for the delivery delay. Notes are required if you choose Other."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DELAY_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`da-issue-option${delayReason === r.value ? ' da-issue-option--selected' : ''}`}
                  onClick={() => setDelayReason(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="da-field" style={{ marginTop: 16 }}>
              <label htmlFor="delay-notes">
                {delayReason === 'other' ? 'Notes (required)' : 'Additional notes (optional)'}
              </label>
              <textarea
                id="delay-notes"
                rows={3}
                placeholder="Describe the delay…"
                value={delayNotes}
                onChange={(e) => setDelayNotes(e.target.value)}
              />
            </div>
            {delayError && <p className="da-alert da-alert--error">{delayError}</p>}
            <div className="da-sheet__actions">
              <button
                type="button"
                className="da-btn da-btn--primary da-btn--block"
                disabled={delaySubmitting}
                onClick={submitDelay}
              >
                {delaySubmitting ? 'Submitting…' : 'Submit Delay Report'}
              </button>
              <button
                type="button"
                className="da-btn da-btn--secondary da-btn--block"
                disabled={delaySubmitting}
                onClick={() => setDelayOpen(false)}
              >
                Cancel
              </button>
            </div>
          </BottomSheet>
        </>
      )}
    </>
  )
}

export default DriverJobDetailsPage
