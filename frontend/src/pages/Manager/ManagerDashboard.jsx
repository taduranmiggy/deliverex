import { useEffect, useMemo, useState } from 'react'
import { fetchManagerDashboard } from '../../api/manager'
import { IconCircleCheckFilled, IconClock, IconTrendingUp } from '../../components/DxIcons'

function RevenueLineMonFri() {
  const values = [98, 124, 118, 152, 140]
  const w = 400
  const h = 120
  const pad = 24
  const vw = w - pad * 2
  const vh = h - pad * 2
  const vmin = Math.min(...values)
  const vmax = Math.max(...values)
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * vw
    const y = pad + vh - ((v - vmin) / (vmax - vmin || 1)) * vh
    return [x, y]
  })
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return (
    <svg width="100%" height={180} viewBox={`0 0 ${w} ${h + 28}`}>
      <defs>
        <linearGradient id="mgrRevGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(45,84,183,0.2)" />
          <stop offset="100%" stopColor="rgba(45,84,183,0.02)" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d={d}
      />
      {pts.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={5} fill="#fff" stroke="var(--primary)" strokeWidth={2} />
      ))}
      {labels.map((label, i) => (
        <text
          key={label}
          x={pad + (i / (labels.length - 1)) * vw}
          y={h + 16}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={11}
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

function CompletedBarsMonFri() {
  const raw = [12, 22, 16, 28, 20]
  const max = Math.max(...raw)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        height: 160,
        padding: '8px 0 24px',
      }}
    >
      {labels.map((label, idx) => (
        <div
          key={label}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <div
            title={`${raw[idx]} deliveries`}
            style={{
              width: '100%',
              maxWidth: 36,
              height: `${Math.round((raw[idx] / max) * 88)}%`,
              minHeight: 20,
              background: 'linear-gradient(180deg, var(--primary) 0%, #1d3557 100%)',
              borderRadius: 6,
            }}
          />
          <span style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--muted)' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

function ManagerDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetchManagerDashboard()
        setStats(response)
      } catch (err) {
        setError(err.message)
      }
    }

    loadDashboard()
  }, [])

  const completedToday = useMemo(() => {
    const raw = stats?.assignments_completed ?? stats?.assignments_active ?? 14
    return typeof raw === 'number' && raw > 0 ? raw : 14
  }, [stats])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Manager Dashboard</h1>
          <p>Analytics and performance overview</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <span className="dx-stat-currency-symbol">₱</span>
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Daily Revenue</div>
            <div className="dx-stat-card__value">₱152,500</div>
            <div className="dx-kpi-delta dx-kpi-delta--up">+0.2% from yesterday</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconTrendingUp />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">On-Time Rate</div>
            <div className="dx-stat-card__value">92%</div>
            <div className="dx-kpi-delta dx-kpi-delta--up">+3% from last week</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconCircleCheckFilled />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Completed Today</div>
            <div className="dx-stat-card__value">{completedToday}</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconClock />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Avg Assignment</div>
            <div className="dx-stat-card__value">1.8 min</div>
            <div className="dx-kpi-delta dx-kpi-delta--up">−0.3 min improvement</div>
          </div>
        </div>
      </div>

      <div className="dx-split-bestfit" style={{ marginTop: 8 }}>
        <div className="dx-panel">
          <h3 className="dx-panel-title">Daily Revenue (₱)</h3>
          <RevenueLineMonFri />
        </div>
        <div className="dx-panel">
          <h3 className="dx-panel-title">Completed Deliveries</h3>
          <CompletedBarsMonFri />
        </div>
      </div>

      <div className="dx-split-bestfit" style={{ marginTop: 16 }}>
        <div className="dx-panel">
          <h3 className="dx-panel-title">Top Performers</h3>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <div className="inline" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                <span><strong>Miguel Reyes</strong> (Driver)</span>
                <span className="badge-dx badge-dx--enroute">95% On-Time</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>18 deliveries</p>
            </div>
            <div>
              <div className="inline" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                <span><strong>Juan Dela Cruz</strong> (Driver)</span>
                <span className="badge-dx badge-dx--dispatched">93% On-Time</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>16 deliveries</p>
            </div>
          </div>
        </div>
        <div className="dx-panel">
          <h3 className="dx-panel-title">Material Insights</h3>
          <div className="dx-activity-item" style={{ borderTop: '1px solid #f3f4f6' }}>
            <span>Most Requested</span>
            <strong>Gravel (55%)</strong>
          </div>
          <div className="dx-activity-item">
            <span>Highest Revenue</span>
            <strong>Cement (₱124.5K)</strong>
          </div>
          <div className="dx-activity-item">
            <span>Avg Load Size</span>
            <strong>8.5 tons</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ManagerDashboard
