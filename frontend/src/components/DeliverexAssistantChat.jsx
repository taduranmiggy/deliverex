import { useCallback, useEffect, useRef, useState } from 'react'
import './DeliverexAssistantChat.css'
import { trackDelivery } from '../api/customer'
import { IconCheckSmall, IconDocOutline, IconMail, IconPhone } from './DxIcons'

const SUPPORT_EMAIL = 'support@deliverex.ph'
const SUPPORT_PHONE = '(+63) 917-123-4567'

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
    detail: null,
    showDemoMapUnavailable: false,
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
      detail: null,
      showDemoMapUnavailable: false,
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
          'Hello! I can help you track deliveries by Job Order ID and answer general Deliverex questions.',
        ],
      },
    ])
    setQuickShown(true)
    setAwaitTrackId(false)
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
        return
      }
      if (label === 'Create account') {
        pushAssistant(['links', { text: 'Create a Deliverex account', href: '/customer/signup' }])
        return
      }
      if (label === 'Log in') {
        pushAssistant(['links', { text: 'Log in to Deliverex', href: '/login' }])
        return
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

      if (/account|login|sign\s*in|register|signup|sign\s*up/.test(lower)) {
        pushAssistant([
          'text',
          'For account-specific access, please log in or create an account.',
        ])
        pushAssistant(['links', { text: 'Log in', href: '/login' }])
        pushAssistant(['links', { text: 'Create account', href: '/customer/signup' }])
        return
      }

      if (/transaction|invoice|billing|payment|history|records/.test(lower)) {
        pushAssistant([
          'text',
          'I cannot access account records here. Please log in to view transactions and delivery history.',
        ])
        pushAssistant(['links', { text: 'Log in', href: '/login' }])
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

    if (kind === 'links') {
      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--bot">
          <div className="dx-msg-ava" aria-hidden>
            D
          </div>
          <div className="dx-msg-bubble">
            <a href={body.href}>{body.text}</a>
          </div>
        </div>
      )
    }

    if (kind === 'tracking_card') {
      const d = body

      const copyCode = async () => {
        try {
          await navigator.clipboard?.writeText(d.tracking_code)
        } catch {
          /* noop */
        }
      }

      const bubbleClass = 'dx-msg-bubble'

      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--bot dx-msg-row--tracking">
          <div className="dx-msg-ava" aria-hidden>
            D
          </div>
          <div className={bubbleClass} style={{ maxWidth: '92%' }}>
            <div className="dx-track-card">
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
                    <button
                      type="button"
                      className="dx-msg-quick"
                      onClick={() => dispatchQuickAction('Create account')}
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      className="dx-msg-quick"
                      onClick={() => dispatchQuickAction('Log in')}
                    >
                      Log in
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
