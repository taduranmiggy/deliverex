import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './DeliverexAssistantChat.css'
import { fetchChatbotWelcome, sendChatbotMessage } from '../api/chatbot'
import { CHAT_FAQ_ITEMS } from '../data/publicFaqs'
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '../config/support'
import { IconMail, IconPhone } from './DxIcons'

const FAQ_ITEMS = CHAT_FAQ_ITEMS

const STATUS_GUIDE = [
  { label: 'Pending', desc: 'Order received; awaiting dispatch.', tone: '#64748b' },
  { label: 'Dispatched', desc: 'Driver and vehicle assigned.', tone: '#2563eb' },
  { label: 'En Route to Pickup', desc: 'Driver heading to pickup location.', tone: '#0891b2' },
  { label: 'Arrived at Pickup', desc: 'Driver at pickup; loading cargo.', tone: '#0d9488' },
  { label: 'Enroute to Destination', desc: 'Cargo loaded; heading to drop-off.', tone: '#0284c7' },
  { label: 'Arrived', desc: 'Driver has reached the destination.', tone: '#d97706' },
  { label: 'Completed', desc: 'Delivery finished successfully.', tone: '#059669' },
]

let msgIdSeq = 0
function nid() {
  msgIdSeq += 1
  return `m-${msgIdSeq}`
}

function statusBadgeClass(label) {
  const map = {
    Assigned: 'badge-dx--dispatched',
    Dispatched: 'badge-dx--dispatched',
    'En Route': 'badge-dx--enroute',
    Arrived: 'badge-dx--arrived',
    Completed: 'badge-dx--completed',
    Pending: 'badge-dx--pending',
  }
  return map[label] || 'badge-dx--muted'
}

function optionsGroupLabel(options, chatState) {
  if (chatState?.mode === 'tracking') return 'Enter Tracking ID or choose'
  if (chatState?.mode === 'inquiry') return 'Reply in chat'
  if (options?.length <= 4) return 'Suggested actions'
  return 'Quick replies'
}

function mapApiMessages(apiMessages) {
  return (apiMessages ?? []).map((item) => ({
    id: nid(),
    role: 'assistant',
    content: [item.type, item.body],
  }))
}

function buildHistory(messages) {
  return messages
    .filter((m) => typeof m.content === 'string' || Array.isArray(m.content))
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : (m.content[0] === 'text' ? m.content[1] : `[${m.content[0]}]`),
    }))
}

export default function DeliverexAssistantChat({ open: openProp, onOpenChange }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [assistantExpanded, setAssistantExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const [typingLabel, setTypingLabel] = useState('Thinking...')
  const [activeOptions, setActiveOptions] = useState([])
  const [chatState, setChatState] = useState({ mode: null })
  const [loading, setLoading] = useState(false)

  const scrollRef = useRef(null)
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  const setOpen = useCallback((v) => {
    if (!isControlled) setUncontrolledOpen(v)
    onOpenChange?.(v)
  }, [isControlled, onOpenChange])

  const pushUser = useCallback((content) => {
    setMessages((prev) => [...prev, { id: nid(), role: 'user', content }])
  }, [])

  const applyApiResponse = useCallback((res) => {
    const assistantRows = mapApiMessages(res?.messages)
    setMessages((prev) => [...prev, ...assistantRows])
    setActiveOptions(res?.suggestions ?? [])
    setChatState(res?.state ?? { mode: null })
    if (res?.typing_label) setTypingLabel(res.typing_label)
  }, [])

  const seedWelcome = useCallback(async () => {
    setTypingLabel('Thinking...')
    setTyping(true)
    try {
      const res = await fetchChatbotWelcome()
      setMessages(mapApiMessages(res?.messages))
      setActiveOptions(res?.suggestions ?? [])
      setChatState(res?.state ?? { mode: null })
      if (res?.typing_label) setTypingLabel(res.typing_label)
    } catch {
      setMessages([{
        id: nid(),
        role: 'assistant',
        content: ['text', 'Hello! Ask me about tracking, concerns, accounts, or how Deliverex works.'],
      }])
      setActiveOptions(['Track Delivery', 'Submit Concern', 'Contact Support'])
    } finally {
      setTyping(false)
    }
  }, [])

  const dispatchMessage = useCallback(async (text, { skipUserBubble = false } = {}) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    if (!skipUserBubble) pushUser(trimmed)
    setInput('')
    setLoading(true)
    setTyping(true)

    const history = buildHistory(messages)
    if (!skipUserBubble) {
      history.push({ role: 'user', content: trimmed })
    }

    try {
      const res = await sendChatbotMessage({
        message: trimmed,
        history,
        state: chatState,
      })
      applyApiResponse(res)
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: nid(),
        role: 'assistant',
        content: ['text', err?.message || 'Something went wrong. Please try again or use Contact Support.'],
      }])
      setActiveOptions(['Track Delivery', 'Contact Support', 'Menu'])
    } finally {
      setTyping(false)
      setLoading(false)
    }
  }, [applyApiResponse, chatState, loading, messages, pushUser])

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
      setTyping(false)
      setTypingLabel('Thinking...')
      setActiveOptions([])
      setChatState({ mode: null })
      setMinimized(false)
      setAssistantExpanded(false)
      setLoading(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    setMinimized(false)
    setAssistantExpanded(false)
    setOpen(false)
  }, [setOpen])

  const handleOptionClick = useCallback((option) => {
    dispatchMessage(option)
  }, [dispatchMessage])

  const inputPlaceholder = chatState?.mode === 'tracking'
    ? 'Enter Tracking ID...'
    : chatState?.mode === 'inquiry'
      ? 'Type your reply...'
      : 'Ask anything about Deliverex...'

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
      const email = body?.email || SUPPORT_EMAIL
      const phone = body?.phone || SUPPORT_PHONE
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <p className="dx-chat-panel-title">Contact Support</p>
          <div className="dx-contact-rows">
            <span className="dx-contact-rows__item">
              <span className="dx-contact-rows__glyph" aria-hidden="true"><IconMail /></span>
              <a href={`mailto:${email}`}>{email}</a>
            </span>
            <span className="dx-contact-rows__item">
              <span className="dx-contact-rows__glyph" aria-hidden="true"><IconPhone /></span>
              <a href={SUPPORT_PHONE_HREF}>{phone}</a>
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
                <strong>{body.last_updated || body.lastUpdated || 'Not yet available'}</strong>
              </div>
              {body.eta ? (
                <div className="dx-chat-kv">
                  <span>ETA</span>
                  <strong>{body.eta}</strong>
                </div>
              ) : null}
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

    if (kind === 'inquiry_submitted') {
      return (
        <div className="dx-msg-bubble dx-msg-bubble--panel">
          <p className="dx-chat-panel-title">Concern Submitted</p>
          <p className="dx-msg-bubble--pre">{body?.message}</p>
          {body?.reference_no ? (
            <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Ref: {body.reference_no}</p>
          ) : null}
          <Link to="/customer/support" className="dx-chat-inline-link">View Support</Link>
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
      <div className="dx-msg-bubble dx-msg-bubble--pre">
        {typeof body === 'string' ? body : 'How can I help you today?'}
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
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>AI-powered · Online</div>
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
                    <p className="dx-chat-options-label">{optionsGroupLabel(activeOptions, chatState)}</p>
                    <div className="dx-msg-quick-row">
                      {activeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="dx-msg-quick"
                          disabled={loading}
                          onClick={() => handleOptionClick(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <form className="dx-assistant-input" onSubmit={(e) => { e.preventDefault(); dispatchMessage(input) }}>
                <label htmlFor="dx-ass-input" className="visually-hidden">Message Deliverex Assistant</label>
                <input
                  id="dx-ass-input"
                  autoComplete="off"
                  placeholder={inputPlaceholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" className="send" disabled={loading}>Send</button>
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
