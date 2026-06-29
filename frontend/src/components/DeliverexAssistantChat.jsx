import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './DeliverexAssistantChat.css'
import { trackDelivery } from '../api/customer'
import { IconMail, IconPhone } from './DxIcons'

const SUPPORT_EMAIL = 'deliverex.support@gmail.com'
const SUPPORT_PHONE = '(+63) 995-582-0222'

const MAIN_OPTIONS = [
  'Track My Delivery',
  'What is a Tracking ID?',
  'Account Help',
  'Contact Support',
  'FAQs',
]

const QUICK_AFTER_TRACK = ['Track Another Delivery', 'Contact Support', 'Return to Menu']
const QUICK_AFTER_FAQ = ['Track My Delivery', 'Account Help', 'Contact Support', 'Return to Menu']
const ACCOUNT_OPTIONS = ['Login', 'Link Delivery', 'Forgot Password']

const WELCOME_MESSAGE = `Hello! I can help you with:

• Tracking your delivery
• Understanding Tracking IDs
• Delivery status updates
• Account assistance
• Contacting support

Choose an option below to begin.`

const TRACKING_ID_PROMPT = `Please enter your Tracking ID.

Example:
TRK-ABC123
or
DLX-2026-001`

const TRACKING_ID_FAQ = `A Tracking ID is a unique reference number assigned to your delivery.

You can find it in:
• SMS notifications
• Email notifications
• Delivery confirmation messages
• Information provided by the dispatcher

Example: TRK-ABC123

Use this Tracking ID to view:
• Delivery status
• Estimated arrival time
• Delivery timeline
• Proof of Delivery (POD)`

let msgIdSeq = 0
function nid() {
  msgIdSeq += 1
  return `m-${msgIdSeq}`
}

function toStatusLabel(statusRaw) {
  const status = String(statusRaw ?? '').toLowerCase().replace(/\s+/g, '_')
  if (status.includes('assigned')) return 'Assigned'
  if (status.includes('in_progress') || status.includes('in_transit') || status.includes('en_route')) return 'En Route'
  if (status.includes('arrived')) return 'Arrived'
  if (status.includes('complete') || status.includes('deliver')) return 'Completed'
  if (status.includes('pending')) return 'Pending'
  return statusRaw || 'Unknown'
}

function statusBadgeClass(label) {
  const map = {
    Assigned: 'badge-dx--dispatched',
    'En Route': 'badge-dx--enroute',
    Arrived: 'badge-dx--arrived',
    Completed: 'badge-dx--completed',
    Pending: 'badge-dx--pending',
  }
  return map[label] || 'badge-dx--muted'
}

const FAQ_ITEMS = [
  {
    q: 'What does Deliverex do?',
    a: 'Deliverex manages dispatching, tracking, POD capture, and delivery records.',
  },
  {
    q: 'How do I track my delivery?',
    a: 'Enter your Tracking ID on the tracking page or use Track My Delivery here.',
  },
  {
    q: 'How do I link a delivery to my account?',
    a: 'Deliveries for your company are linked automatically when a dispatcher creates them. You can also sign in and use Link Delivery if needed.',
  },
  {
    q: 'How do I get a customer account?',
    a: 'Accounts are created by a Deliverex administrator or linked when a dispatcher creates a delivery using your email.',
  },
  {
    q: 'What do delivery statuses mean?',
    a: 'See the delivery status guide for Pending, Dispatched, pickup and destination legs, Arrived, and Completed.',
  },
]

const STATUS_GUIDE = [
  { label: 'Pending', desc: 'Order received; awaiting dispatch.', tone: '#64748b' },
  { label: 'Dispatched', desc: 'Driver and vehicle assigned.', tone: '#2563eb' },
  { label: 'En Route to Pickup', desc: 'Driver heading to pickup location.', tone: '#0891b2' },
  { label: 'Arrived at Pickup', desc: 'Driver at pickup; loading cargo.', tone: '#0d9488' },
  { label: 'Enroute to Destination', desc: 'Cargo loaded; heading to drop-off.', tone: '#0284c7' },
  { label: 'Arrived', desc: 'Driver has reached the destination.', tone: '#d97706' },
  { label: 'Completed', desc: 'Delivery finished successfully.', tone: '#059669' },
]

function optionButtonClass(option) {
  if (QUICK_AFTER_TRACK.includes(option)) return 'dx-msg-quick dx-msg-quick--secondary'
  if (ACCOUNT_OPTIONS.includes(option)) return 'dx-msg-quick dx-msg-quick--account'
  if (MAIN_OPTIONS.includes(option)) return 'dx-msg-quick'
  return 'dx-msg-quick dx-msg-quick--secondary'
}

function optionsGroupLabel(options) {
  if (options.every((o) => QUICK_AFTER_TRACK.includes(o))) return 'Quick actions'
  if (options.some((o) => ACCOUNT_OPTIONS.includes(o))) return 'Account options'
  if (options.every((o) => MAIN_OPTIONS.includes(o))) return 'Choose an option'
  return 'Quick replies'
}

export default function DeliverexAssistantChat({ open: openProp, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [assistantExpanded, setAssistantExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [awaitTrackInput, setAwaitTrackInput] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typingLabel, setTypingLabel] = useState('Checking delivery details...')
  const [activeOptions, setActiveOptions] = useState(MAIN_OPTIONS)
  const [loadingTrack, setLoadingTrack] = useState(false)

  const scrollRef = useRef(null)
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  const setOpen = useCallback((v) => {
    if (!isControlled) setUncontrolledOpen(v)
    onOpenChange?.(v)
  }, [isControlled, onOpenChange])

  const pushAssistant = useCallback((content) => {
    setMessages((prev) => [...prev, { id: nid(), role: 'assistant', content }])
  }, [])

  const pushUser = useCallback((content) => {
    setMessages((prev) => [...prev, { id: nid(), role: 'user', content }])
  }, [])

  const openMainMenu = useCallback(() => {
    setAwaitTrackInput(false)
    setActiveOptions(MAIN_OPTIONS)
  }, [])

  const seedWelcome = useCallback(() => {
    setMessages([
      { id: nid(), role: 'assistant', content: ['text', WELCOME_MESSAGE] },
    ])
    setAwaitTrackInput(false)
    setTyping(false)
    setTypingLabel('Checking delivery details...')
    setActiveOptions(MAIN_OPTIONS)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing, activeOptions, minimized, assistantExpanded])

  useEffect(() => {
    if (open && messages.length === 0) seedWelcome()
  }, [open, messages.length, seedWelcome])

  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      setAwaitTrackInput(false)
      setTyping(false)
      setTypingLabel('Checking delivery details...')
      setActiveOptions(MAIN_OPTIONS)
      setMinimized(false)
      setAssistantExpanded(false)
      setLoadingTrack(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    setMinimized(false)
    setAssistantExpanded(false)
    setOpen(false)
  }, [setOpen])

  const handleTrackingLookup = useCallback(async (raw) => {
    const code = raw.trim()
    if (!code) {
      pushAssistant(['text', TRACKING_ID_PROMPT])
      setActiveOptions(QUICK_AFTER_TRACK)
      return
    }

    setTypingLabel('Checking delivery details...')
    setTyping(true)
    setLoadingTrack(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))

    try {
      const res = await trackDelivery(code)
      const statusLabel = toStatusLabel(res?.status)
      const lastUpdated = Array.isArray(res?.timeline) && res.timeline.length > 0
        ? res.timeline[res.timeline.length - 1]?.at
        : null

      pushAssistant([
        'tracking',
        {
          code: res?.tracking_code ?? code,
          status: statusLabel,
          lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not yet available',
          trackingLink: '/customer/track',
        },
      ])
    } catch (err) {
      pushAssistant(['text', err?.message || 'Unable to check this Tracking ID right now. Please try again.'])
    } finally {
      setTyping(false)
      setLoadingTrack(false)
      setAwaitTrackInput(false)
      setActiveOptions(QUICK_AFTER_TRACK)
    }
  }, [pushAssistant])

  const handleMainOption = useCallback(async (option) => {
    pushUser(option)

    if (option === 'Track My Delivery') {
      setAwaitTrackInput(true)
      pushAssistant(['text', TRACKING_ID_PROMPT])
      setActiveOptions(QUICK_AFTER_TRACK)
      return
    }

    if (option === 'What is a Tracking ID?') {
      pushAssistant(['text', TRACKING_ID_FAQ])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }

    if (option === 'Account Help') {
      pushAssistant(['text', 'Choose an account topic: Login, Link Delivery, or Forgot Password.'])
      setActiveOptions([...ACCOUNT_OPTIONS, ...QUICK_AFTER_FAQ])
      return
    }

    if (option === 'Contact Support') {
      pushAssistant(['text', 'You can contact support through these channels:'])
      pushAssistant(['contact'])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }

    if (option === 'FAQs') {
      pushAssistant(['faq'])
      pushAssistant(['status_guide'])
      setActiveOptions(QUICK_AFTER_FAQ)
    }
  }, [pushAssistant, pushUser])

  const handleQuickAction = useCallback((option) => {
    pushUser(option)

    if (option === 'Track Another Delivery' || option === 'Track My Delivery' || option === 'Track Delivery') {
      setAwaitTrackInput(true)
      pushAssistant(['text', TRACKING_ID_PROMPT])
      setActiveOptions(QUICK_AFTER_TRACK)
      return
    }

    if (option === 'Account Help') {
      pushAssistant(['text', 'Choose an account topic: Login, Link Delivery, or Forgot Password.'])
      setActiveOptions([...ACCOUNT_OPTIONS, ...QUICK_AFTER_FAQ])
      return
    }

    if (option === 'Contact Support') {
      pushAssistant(['contact'])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }

    if (option === 'Return to Menu') {
      pushAssistant(['text', WELCOME_MESSAGE])
      openMainMenu()
    }
  }, [openMainMenu, pushAssistant, pushUser])

  const handleAccountOption = useCallback((option) => {
    pushUser(option)

    if (option === 'Login') {
      pushAssistant(['text', 'Use your registered email and password to sign in.'])
      pushAssistant(['link', { text: 'Customer Login', href: '/customer/login' }])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }

    if (option === 'Link Delivery') {
      pushAssistant([
        'text',
        'Deliveries assigned to your company appear automatically after sign-in. You can also open Link Delivery and enter a Tracking ID if a shipment is not yet visible.',
      ])
      pushAssistant(['link', { text: 'Link Delivery', href: '/customer/link-delivery' }])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }

    if (option === 'Forgot Password') {
      pushAssistant(['text', 'Enter your account email on the forgot password page. We will send a reset link if the account exists.'])
      pushAssistant(['link', { text: 'Forgot Password', href: '/customer/forgot-password' }])
      setActiveOptions(QUICK_AFTER_FAQ)
    }
  }, [pushAssistant, pushUser])

  const handleOptionClick = useCallback((option) => {
    if (MAIN_OPTIONS.includes(option)) {
      handleMainOption(option)
      return
    }
    if (QUICK_AFTER_TRACK.includes(option) || QUICK_AFTER_FAQ.includes(option)) {
      handleQuickAction(option)
      return
    }
    if (ACCOUNT_OPTIONS.includes(option)) {
      handleAccountOption(option)
      return
    }
    pushAssistant([
      'text',
      'I can assist with delivery tracking, Tracking IDs, account guidance, and general delivery questions. Please select one of the available options.',
    ])
    openMainMenu()
  }, [handleAccountOption, handleMainOption, handleQuickAction, openMainMenu, pushAssistant])

  const processUserSend = useCallback(async (raw) => {
    const text = raw.trim()
    if (!text || loadingTrack) return

    pushUser(text)
    setInput('')

    if (awaitTrackInput) {
      await handleTrackingLookup(text)
      return
    }

    const lower = text.toLowerCase()
    if (lower.includes('track')) {
      setAwaitTrackInput(true)
      pushAssistant(['text', TRACKING_ID_PROMPT])
      setActiveOptions(QUICK_AFTER_TRACK)
      return
    }
    if (lower.includes('tracking id') || lower.includes('tracking code') || lower.includes('what is a tracking')) {
      pushAssistant(['text', TRACKING_ID_FAQ])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }
    if (lower.includes('link') && (lower.includes('delivery') || lower.includes('account'))) {
      pushAssistant([
        'text',
        'Sign in, open Link Delivery, and enter your Tracking ID. The shipment email must match your account email.',
      ])
      pushAssistant(['link', { text: 'Link Delivery', href: '/customer/link-delivery' }])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }
    if (lower.includes('support') || lower.includes('contact')) {
      pushAssistant(['contact'])
      setActiveOptions(QUICK_AFTER_FAQ)
      return
    }
    if (lower.includes('account') || lower.includes('login') || lower.includes('password')) {
      pushAssistant(['text', 'For account help, choose Login, Link Delivery, or Forgot Password from the options below.'])
      setActiveOptions([...ACCOUNT_OPTIONS, ...QUICK_AFTER_FAQ])
      return
    }

    pushAssistant([
      'text',
      'I can assist with delivery tracking, Tracking IDs, account guidance, and general delivery questions. Please select one of the available options.',
    ])
    openMainMenu()
  }, [awaitTrackInput, handleTrackingLookup, loadingTrack, openMainMenu, pushAssistant, pushUser])

  const renderAssistantBody = (kind, body) => {
    if (kind === 'text') {
      return <div className="dx-msg-bubble dx-msg-bubble--pre">{body}</div>
    }

    if (kind === 'link') {
      return (
        <div className="dx-msg-bubble">
          <Link to={body.href}>{body.text}</Link>
        </div>
      )
    }

    if (kind === 'contact') {
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <p className="dx-chat-panel-title">Contact Support</p>
          <div className="dx-contact-rows">
            <span className="dx-contact-rows__item">
              <span className="dx-contact-rows__glyph" aria-hidden="true"><IconMail /></span>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </span>
            <span className="dx-contact-rows__item">
              <span className="dx-contact-rows__glyph" aria-hidden="true"><IconPhone /></span>
              <a href="tel:+639955820222">{SUPPORT_PHONE}</a>
            </span>
            <Link to="/customer/support" className="dx-chat-inline-link">Open Contact Form</Link>
          </div>
        </div>
      )
    }

    if (kind === 'tracking') {
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <div className="dx-track-card dx-track-card--enhanced">
            <div className="dx-chat-panel-head">
              <p className="dx-chat-panel-title">Delivery Result</p>
              <span className={`badge-dx ${statusBadgeClass(body.status)}`}>{body.status}</span>
            </div>
            <div className="dx-chat-kv-grid">
              <div className="dx-chat-kv">
                <span>Tracking ID</span>
                <strong>{body.code}</strong>
              </div>
              <div className="dx-chat-kv">
                <span>Last Updated</span>
                <strong>{body.lastUpdated}</strong>
              </div>
            </div>
            <Link
              to="/customer/track"
              state={{ prefillTracking: body.code }}
              className="dx-chat-track-link"
            >
              Open Tracking Page →
            </Link>
          </div>
        </div>
      )
    }

    if (kind === 'faq') {
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <p className="dx-chat-panel-title">FAQs</p>
          <div className="dx-chat-faq-list">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q} className="dx-chat-faq-item">
                <strong>{q}</strong>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (kind === 'status_guide') {
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <p className="dx-chat-panel-title">Delivery Status Guide</p>
          <div className="dx-chat-status-list">
            {STATUS_GUIDE.map(({ label, desc, tone }) => (
              <div key={label} className="dx-chat-status-row">
                <span className="dx-chat-status-dot" style={{ background: tone }} aria-hidden />
                <div>
                  <strong>{label}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="dx-msg-bubble">
        I can assist with delivery tracking, Tracking IDs, account guidance, and general delivery questions. Please select one of the available options.
      </div>
    )
  }

  const renderMessage = (row) => {
    if (row.role === 'user') {
      return (
        <div key={row.id} className="dx-msg-row dx-msg-row--user">
          <div className="dx-msg-ava" aria-hidden>U</div>
          <div className="dx-msg-bubble">{row.content}</div>
        </div>
      )
    }

    const [kind, body] = row.content
    return (
      <div key={row.id} className="dx-msg-row dx-msg-row--bot">
        <div className="dx-msg-ava" aria-hidden>D</div>
        {renderAssistantBody(kind, body)}
      </div>
    )
  }

  const showFabStrip = !open || minimized

  const chatUi = (
    <>
      {showFabStrip ? (
        <div className="dx-chat-launcher">
          <span className="dx-chat-pill" aria-hidden="true">Chat with Deliverex Assistant</span>
          <button
            type="button"
            className="dx-chat-fab"
            aria-label="Chat with Deliverex Assistant"
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
            <div className="dx-assistant-chat__avatar" aria-hidden>D</div>
            <div style={{ flex: 1 }}>
              <div id="dx-assistant-title" style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Deliverex Assistant</div>
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
              <button type="button" onClick={handleClose} title="Close" aria-label="Close chat">×</button>
            </div>
          </div>

          {!minimized ? (
            <>
              <div className="dx-assistant-chat__msgs" ref={scrollRef}>
                {messages.map(renderMessage)}
                {typing ? (
                  <div className="dx-msg-row dx-msg-row--bot">
                    <div className="dx-msg-ava" aria-hidden>D</div>
                    <div className="dx-msg-bubble">
                      <div className="dx-chat-typing">
                        <span className="dx-chat-dot" />
                        <span className="dx-chat-dot" />
                        <span className="dx-chat-dot" />
                        <span>{typingLabel}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
                {activeOptions?.length ? (
                  <div className="dx-chat-options-wrap">
                    <p className="dx-chat-options-label">{optionsGroupLabel(activeOptions)}</p>
                    <div className="dx-msg-quick-row">
                      {activeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={optionButtonClass(option)}
                          onClick={() => handleOptionClick(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <form className="dx-assistant-input" onSubmit={(e) => { e.preventDefault(); processUserSend(input) }}>
                <label htmlFor="dx-ass-input" className="visually-hidden">Message Deliverex Assistant</label>
                <input
                  id="dx-ass-input"
                  autoComplete="off"
                  placeholder={awaitTrackInput ? 'Enter Tracking ID...' : 'Type your message...'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="send" disabled={loadingTrack}>Send</button>
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
        .dx-msg-bubble--pre {
          white-space: pre-line;
        }
      `}</style>
    </>
  )

  return createPortal(chatUi, document.body)
}
