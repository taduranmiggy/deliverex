import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CHART_COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  purple: '#7c3aed',
  muted: '#94a3b8',
}

const STATUS_COLORS = {
  Completed: CHART_COLORS.success,
  'In Progress': CHART_COLORS.primary,
  Pending: CHART_COLORS.warning,
  Cancelled: CHART_COLORS.danger,
  Delayed: CHART_COLORS.purple,
}

function ChartEmpty({ message = 'No data for selected period.' }) {
  return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>{message}</p>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--surface, #fff)',
        border: '1px solid var(--stroke)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: '0.8125rem',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ color: entry.color || 'var(--text)' }}>
          {entry.name}: <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function DailyDeliveriesChart({ data }) {
  if (!data?.length || !data.some((row) => Number(row.count) > 0)) {
    return <ChartEmpty message="No completed deliveries for this period." />
  }
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={36} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Completed" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function JobStatusChart({ data }) {
  const items = (data ?? []).filter((d) => d.value > 0)
  if (!items.length) return <ChartEmpty message="No job status data for selected period." />
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
          >
            {items.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || CHART_COLORS.muted} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8125rem' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DelayReasonsChart({ items }) {
  if (!items?.length) return <ChartEmpty message="No delay reports for selected period." />
  const data = items.map((item) => ({ name: item.label, count: item.count }))
  return (
    <div style={{ width: '100%', height: Math.max(220, data.length * 42) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Reports" fill={CHART_COLORS.warning} radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyDelayTrendChart({ data }) {
  if (!data?.length) return <ChartEmpty message="No monthly delay trends for selected period." />
  const chartData = data.map((row) => {
    const [y, m] = String(row.month).split('-')
    const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    return { label, count: row.count }
  })
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="delayTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.warning} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CHART_COLORS.warning} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={36} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="count" name="Delay reports" stroke={CHART_COLORS.warning} fill="url(#delayTrendFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FleetStatusChart({ fleet }) {
  if (!fleet) return <ChartEmpty />

  const breakdown = [
    { name: 'Available', value: fleet.available ?? 0, color: CHART_COLORS.success },
    { name: 'Assigned', value: fleet.assigned ?? 0, color: CHART_COLORS.primary },
    { name: 'Maintenance', value: fleet.maintenance ?? 0, color: CHART_COLORS.warning },
  ]
  const data = breakdown.filter((d) => d.value > 0)
  const total = breakdown.reduce((sum, row) => sum + row.value, 0)

  if (!total) return <ChartEmpty message="No fleet data available." />

  const singleSlice = data.length === 1
  const plotHeight = singleSlice ? 168 : 210

  return (
    <div className="dx-fleet-status-chart">
      <div className="dx-fleet-status-chart__plot" style={{ height: plotHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy={singleSlice ? '46%' : '48%'}
              innerRadius={singleSlice ? 0 : 46}
              outerRadius={singleSlice ? 64 : 78}
              paddingAngle={data.length > 1 ? 2 : 0}
              label={data.length > 1
                ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
                : false}
              labelLine={data.length > 1}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '0.8125rem', paddingTop: 4 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="dx-fleet-status-chart__stats">
        {breakdown.map((row) => {
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
          return (
            <div key={row.name} className="dx-fleet-status-chart__stat">
              <span className="dx-fleet-status-chart__dot" style={{ background: row.color }} aria-hidden />
              <span className="dx-fleet-status-chart__stat-label">{row.name}</span>
              <strong className="dx-fleet-status-chart__stat-value">{row.value}</strong>
              <span className="dx-fleet-status-chart__stat-pct">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
