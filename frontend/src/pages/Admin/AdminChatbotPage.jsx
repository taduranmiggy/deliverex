import { useMemo, useState } from 'react'
import { IconEyeOutline, IconPencil, IconTrash } from '../../components/DxIcons'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'intents', label: 'Intents' },
  { id: 'faq', label: 'FAQ' },
  { id: 'templates', label: 'Templates' },
  { id: 'routing', label: 'Routing' },
  { id: 'settings', label: 'Settings' },
]

const TOP_INTENTS = [
  { intent: 'Track Delivery', volume: 320, rate: 94, confidence: 92, updated: '2024-02-25' },
  { intent: 'Job Status', volume: 180, rate: 88, confidence: 85, updated: '2024-02-24' },
  { intent: 'Navigation Help', volume: 150, rate: 86, confidence: 80, updated: '2024-02-23' },
  { intent: 'Update Status', volume: 90, rate: 91, confidence: 88, updated: '2024-02-22' },
  { intent: 'OCR Tips', volume: 45, rate: 82, confidence: 78, updated: '2024-02-21' },
]

const INTENT_ROWS = [
  {
    slug: 'track_delivery',
    name: 'Track Delivery',
    description: 'User wants to track delivery status',
    hits: 320,
    rate: 94,
    owner: 'Maria Santos',
  },
  {
    slug: 'job_status',
    name: 'Job Status',
    description: 'Dispatcher checks job order status',
    hits: 180,
    rate: 85,
    owner: 'Juan Dela Cruz',
  },
  {
    slug: 'navigation_help',
    name: 'Navigation Help',
    description: 'Directions and UI help inside the portal',
    hits: 150,
    rate: 86,
    owner: 'Maria Santos',
  },
  {
    slug: 'update_status',
    name: 'Update Status',
    description: 'Prompts for courier status wording',
    hits: 95,
    rate: 91,
    owner: 'Juan Dela Cruz',
  },
  {
    slug: 'ocr_tips',
    name: 'OCR Tips',
    description: 'How to validate delivery documents',
    hits: 60,
    rate: 82,
    owner: 'Maria Santos',
  },
]

const TRAINING_BY_SLUG = {
  track_delivery: [
    '"Saan yung delivery ko?"',
    '"I-track ko yung package"',
    '"Where is my delivery?"',
  ],
  job_status: ['Job status?', 'San ang trabaho?', 'Update sa dispatch'],
  navigation_help: ['Paano mag-login?', 'Saan ang live map?'],
  update_status: ['Mark as delivered', 'En route na po'],
  ocr_tips: ['OCR flagged', 'How to approve document'],
}

const CONVERSATIONS = [
  {
    id: 'CS-2026-0315',
    userLabel: 'Maria Santos (Customer)',
    intent: 'Track Delivery',
    resolved: true,
    duration: '2m 34s',
    at: '2024-02-27 10:15 AM',
  },
  {
    id: 'CS-2026-0314',
    userLabel: 'Juan Dela Cruz (Dispatcher)',
    intent: 'Job Status',
    resolved: true,
    duration: '1m 52s',
    at: '2024-02-27 09:42 AM',
  },
  {
    id: 'CS-2026-0313',
    userLabel: 'Jose Ramirez (Customer)',
    intent: 'Track Delivery',
    resolved: false,
    duration: '3m 18s',
    at: '2024-02-27 09:23 AM',
  },
]

const FAQ_ARTICLES = [
  {
    id: 1,
    title: 'How to track my delivery?',
    category: 'Tracking',
    updated: '2024-02-22',
    published: true,
  },
  {
    id: 2,
    title: 'Accepted payment methods',
    category: 'Payments',
    updated: '2024-02-20',
    published: false,
  },
  {
    id: 3,
    title: 'Site preparation delivery zones',
    category: 'Delivery',
    updated: '2024-02-18',
    published: true,
  },
  {
    id: 4,
    title: 'Contact support after-hours',
    category: 'Support',
    updated: '2024-02-15',
    published: true,
  },
]

const MESSAGE_TEMPLATES = [
  {
    id: 1,
    name: 'Delivery Status',
    type: 'Status',
    updated: '2024-02-24',
    active: true,
  },
  {
    id: 2,
    name: 'ETA Window',
    type: 'Driver Guidance',
    updated: '2024-02-23',
    active: true,
  },
  {
    id: 3,
    name: 'PoD Confirmation',
    type: 'Status',
    updated: '2024-02-21',
    active: true,
  },
  {
    id: 4,
    name: 'Navigation Tips',
    type: 'System',
    updated: '2024-02-19',
    active: true,
  },
  {
    id: 5,
    name: 'Fallback Message',
    type: 'Fallback',
    updated: '2024-02-18',
    active: true,
  },
  {
    id: 6,
    name: 'Off-hours Message',
    type: 'System',
    updated: '2024-02-17',
    active: true,
  },
]

const ROUTING_RULES = [
  {
    id: 1,
    condition: '2 failed detections',
    action: 'Escalate to support@deliverex.com',
    priority: 'High',
    active: true,
  },
  {
    id: 2,
    condition: 'Off-hours (6PM - 8AM)',
    action: 'Send contact details',
    priority: 'Medium',
    active: true,
  },
  {
    id: 3,
    condition: 'Confidence < 80%',
    action: 'Show suggested intents',
    priority: 'Medium',
    active: true,
  },
  {
    id: 4,
    condition: 'PII detected',
    action: 'Auto-redact and alert',
    priority: 'High',
    active: true,
  },
]

function LineTrendChart() {
  const pts = [
    [0, 80],
    [40, 60],
    [80, 70],
    [120, 50],
    [160, 55],
    [200, 40],
    [240, 45],
    [280, 30],
    [320, 35],
    [360, 20],
    [400, 25],
    [440, 15],
    [480, 18],
    [520, 10],
  ]
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  return (
    <svg
      width="100%"
      height={160}
      viewBox="0 0 560 120"
      preserveAspectRatio="none"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="cbLineFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(45,84,183,0.25)" />
          <stop offset="100%" stopColor="rgba(45,84,183,0.02)" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        d={d}
        transform="translate(0,90) scale(1,-0.85)"
      />
      {pts.filter((_, idx) => idx % 3 === 0).map(([x, y], ci) => (
        <circle key={`${x}-${ci}`} cx={x} cy={90 - y * 0.85} r={5} fill="#fff" stroke="var(--primary)" strokeWidth="2" />
      ))}
    </svg>
  )
}

function ResolvedBarChart() {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const resolvedPct = [88, 72, 90, 65, 80, 40, 50]
  const openPct = [12, 18, 10, 20, 14, 8, 10]

  return (
    <>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 150, padding: '8px 4px 0' }}>
        {labels.map((label, idx) => (
          <div
            key={label}
            style={{
              flex: 1,
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              alignItems: 'flex-end',
              height: '100%',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                aria-hidden
                title="Unresolved"
                style={{
                  width: '100%',
                  height: `${openPct[idx]}%`,
                  minHeight: 8,
                  background: '#fca5a5',
                  borderRadius: 4,
                }}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                aria-hidden
                title="Resolved"
                style={{
                  width: '100%',
                  height: `${resolvedPct[idx]}%`,
                  minHeight: 24,
                  background: 'var(--primary)',
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, padding: '6px 4px 0' }}>
        {labels.map((label) => (
          <span key={label} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)' }}>
            {label}
          </span>
        ))}
      </div>
    </>
  )
}

function AdminChatbotPage() {
  const [tab, setTab] = useState('dashboard')
  const [intentSearch, setIntentSearch] = useState('')
  const [selectedSlug, setSelectedSlug] = useState('track_delivery')
  const [faqSearch, setFaqSearch] = useState('')
  const [redactPhone, setRedactPhone] = useState(true)
  const [redactEmail, setRedactEmail] = useState(true)
  const [redactTracking, setRedactTracking] = useState(false)
  const [retentionDays, setRetentionDays] = useState('90')
  const [webhookSecretVisible, setWebhookSecretVisible] = useState(false)

  const filteredIntents = useMemo(() => {
    const q = intentSearch.trim().toLowerCase()
    if (!q) return INTENT_ROWS
    return INTENT_ROWS.filter(
      (row) =>
        row.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q),
    )
  }, [intentSearch])

  const filteredFaq = useMemo(() => {
    const q = faqSearch.trim().toLowerCase()
    if (!q) return FAQ_ARTICLES
    return FAQ_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q),
    )
  }, [faqSearch])

  const selectedIntent =
    INTENT_ROWS.find((row) => row.slug === selectedSlug) || INTENT_ROWS[0]
  const training = TRAINING_BY_SLUG[selectedIntent.slug] || []

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Chatbot Management</h1>
          <p>Manage chatbot intents, conversations, and training data</p>
        </div>
      </header>

      <div className="dx-chat-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dx-chat-tab${tab === item.id ? ' dx-chat-tab--active' : ''}${
              tab === item.id && item.id === 'settings' ? ' dx-chat-tab-settings-active' : ''
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="dx-kpi-grid-4">
            <div className="dx-kpi-card">
              <div className="dx-kpi-card__label">Sessions Today</div>
              <div className="dx-kpi-card__value">85</div>
              <div className="dx-kpi-delta dx-kpi-delta--up">+12% vs yesterday</div>
            </div>
            <div className="dx-kpi-card">
              <div className="dx-kpi-card__label">Resolution Rate</div>
              <div className="dx-kpi-card__value">92%</div>
              <div className="dx-kpi-delta dx-kpi-delta--up">+3% vs last week</div>
            </div>
            <div className="dx-kpi-card">
              <div className="dx-kpi-card__label">Unresolved Today</div>
              <div className="dx-kpi-card__value">7</div>
              <div className="dx-kpi-delta dx-kpi-delta--down">2 fewer than yesterday</div>
            </div>
            <div className="dx-kpi-card">
              <div className="dx-kpi-card__label">Avg Response Time</div>
              <div className="dx-kpi-card__value">1.8s</div>
              <div className="dx-kpi-delta dx-kpi-delta--up">−0.2s vs last week</div>
            </div>
          </div>

          <div className="dx-chart-row">
            <div className="dx-chart-card">
              <h4>Sessions per Day (14 days)</h4>
              <LineTrendChart />
            </div>
            <div className="dx-chart-card">
              <h4>Resolved vs Unresolved</h4>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: '0.75rem' }}>
                <span>
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      background: 'var(--primary)',
                      marginRight: 6,
                      borderRadius: 2,
                    }}
                  />{' '}
                  Resolved
                </span>
                <span>
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      background: '#fca5a5',
                      marginRight: 6,
                      borderRadius: 2,
                    }}
                  />{' '}
                  Unresolved
                </span>
              </div>
              <ResolvedBarChart />
            </div>
          </div>

          <div className="dx-panel">
            <h3 className="dx-panel-title">Top Intents</h3>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Volume</th>
                    <th>Resolution Rate</th>
                    <th>Avg Confidence</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {TOP_INTENTS.map((row) => (
                    <tr key={row.intent}>
                      <td>{row.intent}</td>
                      <td>{row.volume}</td>
                      <td>{row.rate}%</td>
                      <td>{row.confidence}%</td>
                      <td>{row.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'conversations' && (
        <div className="dx-panel">
          <div className="dx-chat-toolbar">
            <input type="search" placeholder="Session ID or Name" aria-label="Search sessions" />
            <select aria-label="Role filter">
              <option>All Roles</option>
              <option>Customer</option>
              <option>Dispatcher</option>
            </select>
            <select aria-label="Status filter">
              <option>All Status</option>
              <option>Resolved</option>
              <option>Unresolved</option>
            </select>
            <button type="button" className="btn-dx-secondary">
              More Filters
            </button>
            <button type="button" className="btn-dx-primary">
              Export
            </button>
          </div>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>User</th>
                  <th>Top Intent</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Date / Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {CONVERSATIONS.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.userLabel}</td>
                    <td>{row.intent}</td>
                    <td>
                      <span
                        className={`badge-dx ${row.resolved ? 'badge-dx--resolved' : 'badge-dx--unresolved'}`}
                      >
                        {row.resolved ? 'Resolved' : 'Unresolved'}
                      </span>
                    </td>
                    <td>{row.duration}</td>
                    <td>{row.at}</td>
                    <td>
                      <button type="button" className="dx-icon-btn" aria-label="View transcript" title="View">
                        <IconEyeOutline />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'intents' && (
        <div className="dx-panel">
          <div className="dx-intents-toolbar">
            <input
              type="search"
              placeholder="Search Intents..."
              value={intentSearch}
              onChange={(e) => setIntentSearch(e.target.value)}
              aria-label="Search intents"
            />
            <button type="button" className="btn-dx-primary">
              + New Intent
            </button>
          </div>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Intent Name</th>
                  <th>Description</th>
                  <th>Hits (7 days)</th>
                  <th>Resolution Rate</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntents.map((row) => (
                  <tr
                    key={row.slug}
                    onClick={() => setSelectedSlug(row.slug)}
                    style={{
                      cursor: 'pointer',
                      outline:
                        selectedSlug === row.slug ? '2px solid rgba(45,84,183,0.35)' : 'none',
                      outlineOffset: -2,
                    }}
                  >
                    <td>{row.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {row.description}
                    </td>
                    <td>{row.hits}</td>
                    <td>{row.rate}%</td>
                    <td>{row.owner}</td>
                    <td>
                      <button type="button" className="dx-icon-btn" aria-label="Edit intent" title="Edit">
                        <IconPencil />
                      </button>
                      <button type="button" className="dx-icon-btn" aria-label="Delete intent" title="Delete">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dx-train-phrases">
            <h4>Training phrases — {selectedIntent.name}</h4>
            <ul>
              {training.map((phrase) => (
                <li key={phrase}>{phrase}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'faq' && (
        <>
          <div className="dx-panel" style={{ marginBottom: 20 }}>
            <div className="dx-intents-toolbar" style={{ marginBottom: 0 }}>
              <input
                type="search"
                placeholder="Search articles..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                aria-label="Search FAQ articles"
              />
              <button type="button" className="btn-dx-primary">
                + New Article
              </button>
            </div>
            <div className="dx-data-table-wrap" style={{ marginTop: 16 }}>
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaq.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.category}</td>
                      <td>{row.updated}</td>
                      <td>
                        <span
                          className={`badge-dx ${row.published ? 'badge-dx--published' : 'badge-dx--draft'}`}
                        >
                          {row.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="dx-icon-btn" aria-label="Edit article" title="Edit">
                          <IconPencil />
                        </button>
                        <button type="button" className="dx-icon-btn" aria-label="Delete article" title="Delete">
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dx-panel">
            <h3 className="dx-panel-title">Article Editor</h3>
            <div className="form-grid">
              <label>
                Title
                <input type="text" placeholder="Article title…" />
              </label>
              <label>
                Category
                <select defaultValue="Tracking">
                  <option value="Tracking">Tracking</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Payments">Payments</option>
                  <option value="Support">Support</option>
                </select>
              </label>
              <label>
                Body
                <textarea rows={10} placeholder="Write the article body that customers see in chat…" />
              </label>
            </div>
          </div>
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="dx-panel" style={{ marginBottom: 20 }}>
            <div className="page-header" style={{ marginBottom: 16, alignItems: 'center' }}>
              <h3 className="dx-panel-title" style={{ margin: 0 }}>
                Message Templates
              </h3>
              <button type="button" className="btn-dx-primary">
                + New Template
              </button>
            </div>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Template Name</th>
                    <th>Type</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {MESSAGE_TEMPLATES.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.type}</td>
                      <td>{row.updated}</td>
                      <td>
                        <span className="badge-dx badge-dx--published">Active</span>
                      </td>
                      <td>
                        <button type="button" className="dx-icon-btn" aria-label="Edit template" title="Edit">
                          <IconPencil />
                        </button>
                        <button type="button" className="dx-icon-btn" aria-label="Delete template" title="Delete">
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dx-panel">
            <h3 className="dx-panel-title">Template Editor</h3>
            <div className="form-grid">
              <label>
                Template Name
                <input type="text" placeholder="Template name…" />
              </label>
              <label>
                Message Content
                <textarea
                  rows={8}
                  placeholder="Use variables like {{tracking_id}}, {{eta_window}}, {{job_id}}…"
                  defaultValue="Your delivery {{tracking_id}} is {{delivery_status}}. ETA: {{eta_window}}."
                />
              </label>
              <div className="dx-variables-bar" role="note">
                Available Variables:{' '}
                <code style={{ fontWeight: 600 }}>
                  tracking_id · eta_window · job_id · customer_name · plate_no
                </code>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'routing' && (
        <>
          <div className="dx-panel" style={{ marginBottom: 20 }}>
            <div className="page-header" style={{ marginBottom: 16, alignItems: 'center' }}>
              <h3 className="dx-panel-title" style={{ margin: 0 }}>
                Routing &amp; Handover Rules
              </h3>
              <button type="button" className="btn-dx-primary">
                + New Rule
              </button>
            </div>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Condition</th>
                    <th>Action</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING_RULES.map((row) => (
                    <tr key={row.id}>
                      <td>{row.condition}</td>
                      <td>{row.action}</td>
                      <td>
                        <span
                          className={`badge-dx ${row.priority === 'High' ? 'badge-dx--prio-high' : 'badge-dx--prio-medium'}`}
                        >
                          {row.priority}
                        </span>
                      </td>
                      <td>
                        <span className="badge-dx badge-dx--published">Active</span>
                      </td>
                      <td>
                        <button type="button" className="dx-icon-btn" aria-label="Edit rule" title="Edit">
                          <IconPencil />
                        </button>
                        <button type="button" className="dx-icon-btn" aria-label="Delete rule" title="Delete">
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dx-panel">
            <h3 className="dx-panel-title">Rule Builder</h3>
            <div className="form-grid" style={{ maxWidth: 480 }}>
              <label>
                Trigger Condition
                <select defaultValue="unresolved_count">
                  <option value="unresolved_count">Unresolved count</option>
                  <option value="confidence">Confidence threshold</option>
                  <option value="off_hours">Off-hours window</option>
                  <option value="pii">PII detected</option>
                </select>
              </label>
              <label>
                Action
                <select defaultValue="email">
                  <option value="email">Email handoff</option>
                  <option value="suggest">Show suggested intents</option>
                  <option value="redact">Auto-redact and alert</option>
                  <option value="contact_card">Send contact details</option>
                </select>
              </label>
              <button type="button" className="btn-dx-primary" style={{ justifySelf: 'start' }}>
                Save Rule
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <div className="dx-panel dx-settings-card">
            <h3 className="dx-panel-title">Privacy &amp; PII Redaction</h3>
            <div className="dx-toggle-row">
              <div className="dx-toggle-meta">
                <strong>Auto-redact phone numbers</strong>
                <span>Automatically detect and mask phone numbers</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={redactPhone}
                className={`dx-switch ${redactPhone ? 'dx-switch--on' : 'dx-switch--off'}`}
                onClick={() => setRedactPhone((v) => !v)}
              />
            </div>
            <div className="dx-toggle-row">
              <div className="dx-toggle-meta">
                <strong>Auto-redact email addresses</strong>
                <span>Automatically detect and mask email addresses</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={redactEmail}
                className={`dx-switch ${redactEmail ? 'dx-switch--on' : 'dx-switch--off'}`}
                onClick={() => setRedactEmail((v) => !v)}
              />
            </div>
            <div className="dx-toggle-row">
              <div className="dx-toggle-meta">
                <strong>Auto-redact tracking IDs</strong>
                <span>Mask tracking IDs in conversation logs</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={redactTracking}
                className={`dx-switch ${redactTracking ? 'dx-switch--on' : 'dx-switch--off'}`}
                onClick={() => setRedactTracking((v) => !v)}
              />
            </div>
          </div>

          <div className="dx-panel dx-settings-card">
            <h3 className="dx-panel-title">Data Retention</h3>
            <label style={{ display: 'grid', gap: 8, fontWeight: 600, marginBottom: 8 }}>
              Log Retention Period
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                style={{ maxWidth: 240 }}
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">365 days</option>
              </select>
            </label>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
              Conversation logs older than this will be automatically deleted.
            </p>
          </div>

          <div className="dx-panel dx-settings-card">
            <h3 className="dx-panel-title">Webhooks &amp; Integrations</h3>
            <label className="form-grid" style={{ gap: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>Webhook URL</span>
              <input
                type="url"
                defaultValue="https://your-api.com/webhook"
                placeholder="https://your-api.com/webhook"
              />
            </label>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Secret Key</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type={webhookSecretVisible ? 'text' : 'password'}
                readOnly
                value="deliverex_sk_live_demo_xxxxxxxx"
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                type="button"
                className="btn-dx-secondary"
                onClick={() => setWebhookSecretVisible((v) => !v)}
                aria-label={webhookSecretVisible ? 'Hide secret' : 'Show secret'}
              >
                {webhookSecretVisible ? (
                  'Hide'
                ) : (
                  <span className="dx-btn-with-icon">
                    <IconEyeOutline /> Show
                  </span>
                )}
              </button>
              <button type="button" className="btn-dx-secondary" title="Rotate key">
                ↻
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default AdminChatbotPage
