import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { acknowledgeDelayReport, fetchAssignments } from '../../api/dispatcher'
import { fetchTrackingLogs } from '../../api/tracking'
import LiveFleetMap from '../../components/LiveFleetMap'
import { PageHeader, ProofImageModal, StatusBadge } from '../../components/ui'
import { Car, CheckCircle2, ExternalLink, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { getDelayReasonLabel } from '../../utils/driverAssignment'
import { formatEventAt } from '../../utils/deliveryTimestamps'

function formatGpsTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function parseCoordinate(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildOsmCoordinateUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

function buildOsmSearchUrl(query) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query || '')}`
}

function DeliveryMonitoringPage() {
  const [assignments, setAssignments]   = useState([])
  const [gpsMap, setGpsMap]             = useState({})
  const [error, setError]               = useState('')
  const [refreshing, setRefreshing]     = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState(null)

  // ── Two-way selection state ────────────────────────────────────────────
  const [selectedId, setSelectedId]     = useState(null)
  const [proofDocId, setProofDocId]     = useState(null)
  const cardRefs                        = useRef({})   // { [assignmentId]: DOMElement }

  // Scroll the selected card into view whenever selectedId changes
  useEffect(() => {
    if (!selectedId) return
    const el = cardRefs.current[selectedId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  const handleSelect = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id))   // click again to deselect
  }, [])

  // ── Data loading ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res    = await fetchAssignments(1)
      const active = (res.data || []).filter((a) => !['completed', 'cancelled'].includes(a.status))
      setAssignments(active)

      const entries = await Promise.allSettled(
        active.map((a) =>
          fetchTrackingLogs(a.id, 1)
            .then((r) => {
              const latest = r.latest
              if (!latest?.lat || !latest?.lng) return null
              return [a.id, {
                lat: Number(latest.lat),
                lng: Number(latest.lng),
                at: latest.at,
                speedKmh: latest.speed_kmh,
                offline: latest.offline,
                syncedAt: latest.synced_at,
                performedOffline: latest.performed_offline,
              }]
            })
            .catch(() => null),
        ),
      )
      const map = {}
      entries.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          const [id, coords] = r.value
          map[id] = coords
        }
      })
      setGpsMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        load()
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [load])

  const handleAcknowledge = async (reportId) => {
    setAcknowledgingId(reportId)
    try {
      await acknowledgeDelayReport(reportId)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAcknowledgingId(null)
    }
  }

  const { mapMarkers, routeLines, unavailableMessage } = useMemo(() => {
    const markers = []
    const lines = []
    let missingDriverGps = false

    assignments.forEach((a) => {
      const gps = gpsMap[a.id]
      const pickupLat = parseCoordinate(a.job_order?.pickup_latitude)
      const pickupLng = parseCoordinate(a.job_order?.pickup_longitude)
      const dropoffLat = parseCoordinate(a.job_order?.dropoff_latitude)
      const dropoffLng = parseCoordinate(a.job_order?.dropoff_longitude)
      const destinationAddress = buildDisplayAddress('dropoff', a.job_order) || a.job_order?.dropoff_location || '—'
      const destinationAvailable = Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)
      const pickupAvailable = Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
      const jobPublicId = formatJobPublicId(a.job_order_id)

      if (pickupAvailable) {
        markers.push({
          id: `pickup-${a.id}`,
          kind: 'pickup',
          lat: pickupLat,
          lng: pickupLng,
          jobId: jobPublicId,
          trackingId: a.job_order?.tracking_code ?? null,
          address: buildDisplayAddress('pickup', a.job_order) || a.job_order?.pickup_location || '—',
          mapsUrl: buildOsmCoordinateUrl(pickupLat, pickupLng),
        })
      }

      if (destinationAvailable) {
        markers.push({
          id: `destination-${a.id}`,
          kind: 'destination',
          lat: dropoffLat,
          lng: dropoffLng,
          jobId: jobPublicId,
          trackingId: a.job_order?.tracking_code ?? null,
          customerName: buildDisplayName(a.job_order) || '—',
          address: destinationAddress,
          mapsUrl: buildOsmCoordinateUrl(dropoffLat, dropoffLng),
        })
      }

      if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
        markers.push({
          id: a.id,
          kind: 'driver',
          lat: gps.lat,
          lng: gps.lng,
          label: a.driver?.user?.name ?? 'Driver',
          sublabel: `${jobPublicId} · ${a.status}`,
          jobId: jobPublicId,
          trackingId: a.job_order?.tracking_code ?? null,
          vehicle: a.vehicle?.plate_no ?? '—',
          status: a.status,
          gpsAt: gps.at,
          speedKmh: gps.speedKmh,
          offline: gps.offline,
          gpsSyncedAt: gps.syncedAt,
          gpsPerformedOffline: gps.performedOffline,
          isOffline: gps.offline?.state && gps.offline.state !== 'online',
          mapsUrl: buildOsmCoordinateUrl(gps.lat, gps.lng),
          onViewDetails: handleSelect,
        })

        if (destinationAvailable) {
          lines.push({
            id: `line-${a.id}`,
            from: { lat: gps.lat, lng: gps.lng },
            to: { lat: dropoffLat, lng: dropoffLng },
            status: a.status,
          })
        }
      } else if (destinationAvailable) {
        missingDriverGps = true
      }
    })

    return {
      mapMarkers: markers,
      routeLines: lines,
      unavailableMessage: missingDriverGps ? 'Driver location is currently unavailable.' : '',
    }
  }, [assignments, gpsMap, handleSelect])

  return (
    <>
      <PageHeader title="Tracking" subtitle="Latest driver updates and last reported status">
        <button type="button" className="btn-dx-secondary btn-sm" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.7s linear infinite' } : {}} />
          Refresh
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      {/* Sync hint */}
      {assignments.length > 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 14 }}>
          Click a delivery card to locate it on the map — or click a map pin to highlight the card below.
        </p>
      )}

      <div className="dx-split-bestfit">
        {/* ── Map panel ── */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Last Known Locations</h3>
          <LiveFleetMap
            markers={mapMarkers}
            routeLines={routeLines}
            unavailableMessage={unavailableMessage}
            selectedId={selectedId}
            onSelect={handleSelect}
            loading={refreshing && assignments.length === 0}
          />
        </div>

        {/* ── Delivery cards panel ── */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h3 className="dx-panel-title" style={{ margin: 0 }}>Active Deliveries</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{assignments.length} active</span>
          </div>

          <div className="dx-driver-cards" style={{ maxHeight: 480 }}>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '32px 0' }}>
                No active deliveries.
              </p>
            ) : (
              assignments.map((a) => {
                const gps       = gpsMap[a.id]
                const delay     = a.latest_delay_report
                const arrivedLog = a.latest_arrived_status_log
                const isPastDue = a.job_order?.scheduled_end && new Date(a.job_order.scheduled_end).getTime() < Date.now()
                const isActive  = selectedId === a.id
                const mapsUrl   = gps
                  ? buildOsmCoordinateUrl(gps.lat, gps.lng)
                  : buildOsmSearchUrl(buildDisplayAddress('dropoff', a.job_order) || a.job_order?.dropoff_location || '')

                return (
                  <div
                    key={a.id}
                    ref={(el) => { if (el) cardRefs.current[a.id] = el }}
                    className={`dx-driver-card-dx${isActive ? ' dx-driver-card-dx--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onClick={() => handleSelect(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(a.id) }
                    }}
                  >
                    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: '0.875rem' }}>{a.driver?.user?.name ?? 'Driver'}</strong>
                        {isActive && (
                          <span className="dx-card-active-badge">
                            ● Selected
                          </span>
                        )}
                      </div>
                      <StatusBadge status={a.status} />
                    </header>

                    <div className="dx-driver-muted" style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600 }}>Job {formatJobPublicId(a.job_order_id)}</div>
                      <div style={{ marginTop: 3 }}>
                        {buildDisplayAddress('pickup', a.job_order) || a.job_order?.pickup_location || '—'}
                        {' → '}
                        {buildDisplayAddress('dropoff', a.job_order) || a.job_order?.dropoff_location || '—'}
                      </div>
                      <div style={{ marginTop: 6, fontSize: '0.8125rem' }}>
                        <strong>Last Reported Status:</strong> {a.status?.replace(/_/g, ' ') ?? '—'}
                      </div>

                      {arrivedLog?.arrival_verified && (
                        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.8125rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={14} />
                          <span>
                            Arrival GPS Verified
                            {formatEventAt(arrivedLog) && (
                              <span style={{ color: '#15803d', marginLeft: 6 }}>
                                {formatEventAt(arrivedLog)}
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} />
                        {gps
                          ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                          : 'No location reported yet'}
                      </div>
                      {gps?.at && (
                        <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                          Last Updated: {formatGpsTime(gps.at)}
                        </div>
                      )}
                      <div style={{ marginTop: 3 }}>
                        <Car size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {a.vehicle?.plate_no ?? '—'}
                      </div>

                      {(isPastDue || delay) && (
                        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#991b1b' }}>
                            {delay ? 'Reported Delay' : 'Past Scheduled Window'}
                          </div>
                          {delay ? (
                            <>
                              <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>
                                <strong>Reason:</strong> {getDelayReasonLabel(delay.delay_reason)}
                              </div>
                              {delay.delay_notes && (
                                <div style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted)' }}>{delay.delay_notes}</div>
                              )}
                              <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Reported {formatEventAt(delay) ?? '—'}
                              </div>
                              {delay.acknowledged_at ? (
                                <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle2 size={12} /> Acknowledged
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-dx-primary btn-sm"
                                  style={{ marginTop: 8 }}
                                  disabled={acknowledgingId === delay.id}
                                  onClick={(e) => { e.stopPropagation(); handleAcknowledge(delay.id) }}
                                >
                                  {acknowledgingId === delay.id ? 'Acknowledging…' : 'Acknowledge Delay'}
                                </button>
                              )}
                            </>
                          ) : (
                            <div style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                              No delay reason reported yet.
                            </div>
                          )}
                        </div>
                      )}

                      {/* En Route departure proof */}
                      {(() => {
                        const depDoc = a.delivery_documents?.find((d) => d.type === 'departure')
                        return depDoc ? (
                          <button
                            type="button"
                            className="btn-dx-secondary btn-sm"
                            style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={(e) => { e.stopPropagation(); setProofDocId(depDoc.id) }}
                          >
                            🖼 View En Route Proof
                          </button>
                        ) : null
                      })()}

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-dx-secondary btn-sm"
                        style={{ marginTop: 8, display: 'inline-flex', gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} /> Open in OpenStreetMap
                      </a>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {proofDocId && (
        <ProofImageModal
          documentId={proofDocId}
          title="En Route Proof"
          onClose={() => setProofDocId(null)}
        />
      )}
    </>
  )
}

export default DeliveryMonitoringPage
