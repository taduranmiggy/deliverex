import { useCallback, useEffect, useRef, useState } from 'react'
import './DeliverexAssistantChat.css'
import { trackDelivery } from '../api/customer'
import { IconCheckSmall, IconDocOutline, IconMail, IconPhone } from './DxIcons'

const SUPPORT_EMAIL = 'support@deliverex.ph'
const SUPPORT_PHONE = '(+63) 917-123-4567'

const MOCK_DETAIL = {
  client: 'Maria Santos',
  material: 'Cement - 50 bags',
  origin: 'Quezon City Depot',
  destination: 'Makati Construction Site',
  driver: 'Juan Dela Cruz',
  vehicle: 'Isuzu GIGA 10W',
  amount: '₱12,450.00',
}

const MOCK_TRACKING = {
  'DLX2026-001': {
    tracking_code: 'DLX2026-001',
    badgeLabel: 'En Route',
    badgeClass: 'badge-dx--enroute',
    eta_window: '10:30–11:00 AM',
    proofAvailable: false,
    proofLabel: 'Not yet available',
    updateLine: 'Driver departed from depot at 9:45 AM.',
    approximate_location: null,
    detail: MOCK_DETAIL,
    showDemoMapUnavailable: true,
  },
}

let msgIdSeq = 0
function nid() {
  msgIdSeq += 1
  return `m-${msgIdSeq}`
}

function normalizeStatusBadge(statusRaw) {
  const s = String(statusRaw ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_')

  const map = [
    [['completed', 'delivered'], { label: 'Completed', cls: 'badge-dx--completed' }],
    [
      ['dispatched', 'assigned', 'in_transit', 'en_route', 'enroute'],
      { label: 'En Route', cls: 'badge-dx--enroute' },
    ],
    [['pending', 'planned'], { label: 'Pending', cls: 'badge-dx--pending' }],
  ]
  for (const [keys, meta] of map) {
    if (keys.some((k) => s.includes(k))) return meta
  }
  return { label: s.replace(/_/g, ' ') || 'Unknown', cls: 'badge-dx--muted' }
}

async function lookupTracking(raw) {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) {
    throw new Error('Enter a Tracking ID first.')
  }

  try {
    const api = await trackDelivery(code)
    const fallbackMock = MOCK_TRACKING[code]
    const badge = normalizeStatusBadge(api.status)
    const statusLc = String(api.status ?? '').toLowerCase()
    const completed = statusLc.includes('complete') || statusLc.includes('deliver')

    let etaDisplay = api.eta_window
    if (!etaDisplay || etaDisplay.includes('ETA window to be calculated')) {
      etaDisplay = fallbackMock?.eta_window ?? 'See latest status update below'
    }

    const proofAvailable = completed ? true : Boolean(fallbackMock?.proofAvailable)
    const proofLabel = completed
      ? 'Available — check your confirmation email'
      : (fallbackMock?.proofLabel ?? 'Not yet available')

    return {
      source: 'api',
      tracking_code: api.tracking_code ?? code,
      badgeLabel: badge.label,
      badgeClass: badge.cls,
      eta_window: etaDisplay,
      proofAvailable,
      proofLabel,
      updateLine:
        fallbackMock?.updateLine ?? `Latest status recorded: ${String(api.status ?? 'unknown')}.`,
      approximate_location: api.approximate_location,
      detail: fallbackMock?.detail ?? null,
      showDemoMapUnavailable: !api.approximate_location && Boolean(fallbackMock?.detail),
    }
  } catch {
    const mock = MOCK_TRACKING[code]
    if (mock) return { ...mock, source: 'demo' }

    throw new Error(
      "We couldn't find an active shipment with that ID. Confirm the code from your paperwork or coordinator.",
    )
  }
}

/**
 * @param {{ open?: boolean, onOpenChange?: (v: boolean) => void }} props
 * When `open` is omitted, the widget manages visibility internally (FAB opens it).
 */
export default function DeliverexAssistantChat({ open: openProp, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  const setOpen = useCallback(
    (v) => {
      if (!isControlled) setUncontrolledOpen(v)
      onOpenChange?.(v)
    },
    [isControlled, onOpenChange],
  )

  const [minimized, setMinimized] = useState(false)
  const [assistantExpanded, setAssistantExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [quickShown, setQuickShown] = useState(true)
  const [awaitTrackId, setAwaitTrackId] = useState(false)
  /** Message ids whose job-detail panel is collapsed (hidden). */
  const [trackingDetailHidden, setTrackingDetailHidden] = useState(() => new Set())

  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, quickShown, minimized, assistantExpanded])

  const pushAssistant = useCallback((content) => {
    setMessages((prev) => [...prev, { id: nid(), role: 'assistant', content }])
  }, [])

  const pushUser = useCallback((text) => {
    setMessages((prev) => [...prev, { id: nid(), role: 'user', content: text }])
  }, [])

  const seedWelcome = useCallback(() => {
    setMessages([
      {
        id: nid(),
        role: 'assistant',
        content: [
          'text',
          'Hello! I can help you check delivery status, ETA windows, and proof-of-delivery information.',
        ],
      },
    ])
    setQuickShown(true)
    setAwaitTrackId(false)
    setTrackingDetailHidden(new Set())
  }, [])

  useEffect(() => {
    if (open && messages.length === 0) seedWelcome()
  }, [open, messages.length, seedWelcome])

  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      setQuickShown(true)
      setAwaitTrackId(false)
      setMinimized(false)
      setAssistantExpanded(false)
      setTrackingDetailHidden(new Set())
    }
  }, [open])

  const handleClose = useCallback(() => {
    setMinimized(false)
    setAssistantExpanded(false)
    setOpen(false)
  }, [setOpen])

  const dispatchQuickAction = useCallback(
    async (label) => {
      setQuickShown(false)
      pushUser(label)
      if (label === 'Track Delivery') {
        setAwaitTrackId(true)
        pushAssistant(['text', 'Please enter your Tracking ID.'])
        return
      }
      if (label === "What's a Tracking ID?" || label === 'What\'s a Tracking ID?') {
        pushAssistant([
          'text',
          `A Tracking ID uniquely identifies your delivery. It appears on SMS and paperwork — for example DLX2026-001.`,
        ])
        return
      }
      if (label === 'Contact Support') {
        pushAssistant(['text', 'You can reach our support team at:'])
        pushAssistant(['contact'])
      }
    },
    [pushAssistant, pushUser],
  )

  const processUserSend = useCallback(
    async (raw) => {
      const text = raw.trim()
      if (!text) return

      pushUser(text)
      setInput('')
      const lower = text.toLowerCase()

      if (awaitTrackId) {
        setAwaitTrackId(false)
        setQuickShown(false)
        try {
          const payload = await lookupTracking(text)
          pushAssistant(['tracking_card', payload])
        } catch (err) {
          pushAssistant([
            'text',
            typeof err.message === 'string'
              ? err.message
              : 'Something went wrong. Try again shortly.',
          ])
        }
        return
      }

      if (/^track(ing)?$/.test(lower) || (lower.includes('track') && text.length < 14)) {
        dispatchQuickAction('Track Delivery')
        return
      }
      if (/contact|support|help\s*desk/.test(lower)) {
        dispatchQuickAction('Contact Support')
        return
      }
      if (/tracking\s*id|what.*id|where.*code/.test(lower)) {
        dispatchQuickAction("What's a Tracking ID?")
        return
      }

      pushAssistant([
        'text',
        'Choose a quick action below, or type “Track” to look up a delivery.',
      ])
      setQuickShown(true)
    },
    [awaitTrackId, dispatchQuickAction, pushAssistant, pushUser],
  )

  const toggleJobDetailsCollapsed = (id) => {
    setTrackingDetailHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderMessage = (row) => {
    if (row.role === 'user') {
      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--user">
          <div className="dx-msg-ava" aria-hidden>
            U
          </div>
          <div className="dx-msg-bubble">{row.content}</div>
        </div>
      )
    }

    const [kind, body] = row.content

    if (kind === 'text') {
      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--bot">
          <div className="dx-msg-ava" aria-hidden>
            D
          </div>
          <div className="dx-msg-bubble">{body}</div>
        </div>
      )
    }

    if (kind === 'contact') {
      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--bot">
          <div className="dx-msg-ava" aria-hidden>
            D
          </div>
          <div className="dx-msg-bubble">
            <div className="dx-contact-rows">
              <span className="dx-contact-rows__item">
                <span className="dx-contact-rows__glyph" aria-hidden="true">
                  <IconMail />
                </span>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </span>
              <span className="dx-contact-rows__item">
                <span className="dx-contact-rows__glyph" aria-hidden="true">
                  <IconPhone />
                </span>
                <a href="tel:+639171234567">{SUPPORT_PHONE}</a>
              </span>
            </div>
          </div>
        </div>
      )
    }

    if (kind === 'tracking_card') {
      const d = body
      const hasJobDetails = Boolean(d.detail)
      const detailsPanelOpen = hasJobDetails && !trackingDetailHidden.has(row.id)

      const coords = d.approximate_location
      const hasCoords =
        coords &&
        typeof coords.lat === 'number' &&
        typeof coords.lng === 'number' &&
        !Number.isNaN(coords.lat)

      const copyCode = async () => {
        try {
          await navigator.clipboard?.writeText(d.tracking_code)
        } catch {
          /* noop */
        }
      }

      const bubbleClass = hasJobDetails ? 'dx-msg-bubble dx-msg-bubble--job-sheet' : 'dx-msg-bubble'

      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--bot dx-msg-row--tracking">
          <div className="dx-msg-ava" aria-hidden>
            D
          </div>
          <div className={bubbleClass} style={hasJobDetails ? { maxWidth: '94%' } : { maxWidth: '92%' }}>
            <div className={hasJobDetails ? 'dx-track-card dx-track-card--stacked' : 'dx-track-card'}>
              {hasJobDetails ? (
                <>
                  <div className="dx-track-summary">
                    <strong>Tracking result</strong>
                    <span className={`badge-dx ${d.badgeClass}`}>{d.badgeLabel}</span>
                    <div className="dx-track-meta">
                      <div>
                        <span>ETA Window</span>
                        <br />
                        <strong>{d.eta_window}</strong>
                      </div>
                      <div className="dx-pod-row">
                        <span>Proof of delivery</span>
                        <span
                          className={`dx-pod-glyph${d.proofAvailable ? ' dx-pod-glyph--ok' : ''}`}
                          aria-hidden
                        >
                          {d.proofAvailable ? <IconCheckSmall /> : <IconDocOutline />}
                        </span>
                        <strong>{d.proofLabel}</strong>
                      </div>
                      <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                        {d.updateLine}
                      </p>
                    </div>
                  </div>
                  <div className="dx-job-delivery-wrap">
                    {detailsPanelOpen ? (
                      <>
                        <p className="dx-job-delivery-title">Job delivery details</p>
                        <div className="dx-job-kv-list">
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Client</span>
                            <span className="dx-job-kv-value">{d.detail.client}</span>
                          </div>
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Material</span>
                            <span className="dx-job-kv-value">{d.detail.material}</span>
                          </div>
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Origin</span>
                            <span className="dx-job-kv-value">{d.detail.origin}</span>
                          </div>
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Destination</span>
                            <span className="dx-job-kv-value">{d.detail.destination}</span>
                          </div>
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Driver</span>
                            <span className="dx-job-kv-value">{d.detail.driver}</span>
                          </div>
                          <div className="dx-job-kv-row">
                            <span className="dx-job-kv-label">Vehicle</span>
                            <span className="dx-job-kv-value">{d.detail.vehicle}</span>
                          </div>
                          <div className="dx-job-kv-row dx-job-kv-row--amount">
                            <span className="dx-job-kv-label">Amount</span>
                            <span className="dx-job-kv-value">{d.detail.amount}</span>
                          </div>
                        </div>

                        {hasCoords ? (
                          <div className="dx-map-mini dx-map-mini--coords">
                            Approx. {coords.lat}, {coords.lng}
                          </div>
                        ) : (
                          <div className="dx-map-mini" role="status">
                            <svg
                              className="dx-map-pin-icon"
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              aria-hidden
                            >
                              <path d="M12 21s-6-5.35-6-10a6 6 0 1 1 12 0c0 4.65-6 10-6 10z" />
                              <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" />
                            </svg>
                            <span>Location unavailable</span>
                          </div>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="dx-hide-details"
                      onClick={() => toggleJobDetailsCollapsed(row.id)}
                    >
                      {detailsPanelOpen ? 'Hide Details' : 'Delivery details'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong>Tracking result</strong>
                  <span className={`badge-dx ${d.badgeClass}`}>{d.badgeLabel}</span>
                  <div className="dx-track-meta">
                    <div>
                      <span>ETA Window</span>
                      <br />
                      <strong>{d.eta_window}</strong>
                    </div>
                    <div className="dx-pod-row">
                      <span>Proof of delivery</span>
                      <span
                        className={`dx-pod-glyph${d.proofAvailable ? ' dx-pod-glyph--ok' : ''}`}
                        aria-hidden
                      >
                        {d.proofAvailable ? <IconCheckSmall /> : <IconDocOutline />}
                      </span>
                      <strong>{d.proofLabel}</strong>
                    </div>
                    <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {d.updateLine}
                    </p>
                  </div>
                </>
              )}

              <div className="dx-track-copy">
                <span />
                <button type="button" onClick={copyCode}>
                  Copy ID
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  /** FAB when chat closed or minimized; hidden while expanded */
  const showFabStrip = !open || minimized

  return (
    <>
      {showFabStrip ? (
        <div className="landing-chat-launcher-pill-row" aria-live="polite">
          <span className="dx-chat-pill">Chat with Deliverex Assistant</span>
          <button
            type="button"
            className="dx-chat-fab-landing"
            aria-label="Open Deliverex Assistant"
            onClick={() => {
              setMinimized(false)
              setAssistantExpanded(false)
              setOpen(true)
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </button>
        </div>
      ) : null}

      {!open ? null : (
        <div
          className={`dx-assistant-chat dx-assistant-chat--launcher ${minimized ? 'dx-assistant-chat--minimized' : ''} ${assistantExpanded ? 'dx-assistant-chat--expanded' : ''}`}
          role="dialog"
          aria-labelledby="dx-assistant-title"
        >
          <div className="dx-assistant-chat__hdr">
            <div className="dx-assistant-chat__avatar" aria-hidden>
              D
            </div>
            <div style={{ flex: 1 }}>
              <div id="dx-assistant-title" style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                Deliverex Assistant
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Online</div>
            </div>
            <div className="dx-assistant-chat__hdr-controls">
              <button
                type="button"
                onClick={() => {
                  setMinimized((m) => {
                    if (!m) setAssistantExpanded(false)
                    return !m
                  })
                }}
                title={minimized ? 'Restore' : 'Minimize'}
                aria-label={minimized ? 'Restore chat' : 'Minimize chat'}
              >
                {minimized ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 14h6v6M14 4h6v6M20 4l-5 5M4 20l5-5" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                disabled={minimized}
                onClick={() => setAssistantExpanded((e) => !e)}
                title={assistantExpanded ? 'Smaller window' : 'Expand window'}
                aria-label={assistantExpanded ? 'Shrink chat window' : 'Expand chat window'}
              >
                {assistantExpanded ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button type="button" onClick={handleClose} title="Close" aria-label="Close chat">
                ×
              </button>
            </div>
          </div>

          {!minimized ? (
            <>
              <div className="dx-assistant-chat__msgs" ref={scrollRef}>
                {messages.map(renderMessage)}
                {quickShown && messages.length > 0 ? (
                  <div className="dx-msg-quick-row">
                    <button
                      type="button"
                      className="dx-msg-quick"
                      onClick={() => dispatchQuickAction('Track Delivery')}
                    >
                      Track Delivery
                    </button>
                    <button
                      type="button"
                      className="dx-msg-quick"
                      onClick={() => dispatchQuickAction("What's a Tracking ID?")}
                    >
                      What&apos;s a Tracking ID?
                    </button>
                    <button
                      type="button"
                      className="dx-msg-quick"
                      onClick={() => dispatchQuickAction('Contact Support')}
                    >
                      Contact Support
                    </button>
                  </div>
                ) : null}
              </div>
              <form
                className="dx-assistant-input"
                onSubmit={(e) => {
                  e.preventDefault()
                  processUserSend(input)
                }}
              >
                <label htmlFor="dx-ass-input" className="visually-hidden">
                  Message Deliverex Assistant
                </label>
                <input
                  id="dx-ass-input"
                  autoComplete="off"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      processUserSend(input)
                    }
                  }}
                />
                <button type="submit" className="send">
                  Send
                </button>
              </form>
            </>
          ) : null}
        </div>
      )}

      <style>{`
        .visually-hidden {
          position: absolute !important;
          height: 1px; width: 1px;
          overflow: hidden; clip: rect(1px,1px,1px,1px);
          white-space: nowrap;
        }
      `}</style>
    </>
  )
}
