import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import enUS from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { fetchCalendarEvents, fetchJobOrder } from '../../api/dispatcher'
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { AlertTriangle, Calendar, Search, X } from 'lucide-react'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const STATUS_COLORS = {
  pending:        { bg: '#fef3c7', border: '#d97706', text: '#92400e', label: 'Pending' },
  assigned:       { bg: '#dbeafe', border: '#2563eb', text: '#1e40af', label: 'Assigned' },
  in_progress:    { bg: '#ede9fe', border: '#7c3aed', text: '#5b21b6', label: 'En Route' },
  arrived:        { bg: '#cffafe', border: '#0891b2', text: '#0e7490', label: 'Arrived' },
  completed:      { bg: '#dcfce7', border: '#16a34a', text: '#166534', label: 'Completed' },
  issue_reported: { bg: '#ffedd5', border: '#ea580c', text: '#9a3412', label: 'Issue Reported' },
  delayed:        { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', label: 'Delayed' },
  cancelled:      { bg: '#f1f5f9', border: '#64748b', text: '#475569', label: 'Cancelled' },
}

const VIEW_MAP = { month: 'month', week: 'week', day: 'day' }

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function EventDetailModal({ job, event, onClose }) {
  if (!event) return null
  const assignment = job?.assignments?.[0]
  const colors = STATUS_COLORS[event.category] ?? STATUS_COLORS.assigned

  return (
    <div className="dx-cal-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="dx-cal-modal dx-cal-modal--wide" role="dialog" aria-labelledby="cal-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="dx-cal-modal__head">
          <div>
            <h2 id="cal-modal-title" style={{ margin: 0, fontSize: '1.125rem' }}>{event.job_number}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>{event.customer_name}</p>
          </div>
          <button type="button" className="dx-detail-panel__close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dx-cal-modal__body">
          {event.has_conflict && (
            <p className="notice error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} /> Schedule Conflict Detected
            </p>
          )}
          <div className="dx-kv"><span>Client</span><strong>{event.customer_name ?? '—'}</strong></div>
          <div className="dx-kv"><span>Material Type</span>
            <strong style={{ textTransform: 'capitalize' }}>
              {job?.material_type ? String(job.material_type).replace(/_/g, ' ') : event.material_type ? String(event.material_type).replace(/_/g, ' ') : '—'}
            </strong>
          </div>
          <div className="dx-kv"><span>Specification / Size</span><strong>{job?.specification_size ?? event.specification_size ?? '—'}</strong></div>
          <div className="dx-kv"><span>Load Volume</span><strong>{job?.volume_m3 ?? event.volume_m3 ? `${job?.volume_m3 ?? event.volume_m3} m³` : '—'}</strong></div>
          <div className="dx-kv"><span>Pickup</span><strong>{event.pickup_location ?? job?.pickup_location ?? '—'}</strong></div>
          <div className="dx-kv"><span>Destination</span><strong>{event.dropoff_location ?? job?.dropoff_location ?? '—'}</strong></div>
          <div className="dx-kv"><span>Driver</span><strong>{event.driver_name ?? assignment?.driver?.user?.name ?? '—'}</strong></div>
          <div className="dx-kv"><span>Vehicle</span><strong>{event.vehicle_name ?? event.vehicle_plate ?? '—'}</strong></div>
          <div className="dx-kv"><span>Status</span>
            <span className={jobStatusBadgeClass(event.status)} style={{ marginRight: 8 }}>
              {formatJobStatus(event.status)}
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: colors.bg, color: colors.text }}>
              {colors.label}
            </span>
          </div>
          <div className="dx-kv"><span>Scheduled Start</span><strong>{formatDateTime(event.start ?? job?.scheduled_start)}</strong></div>
          <div className="dx-kv"><span>Scheduled End</span><strong>{formatDateTime(event.end ?? job?.scheduled_end)}</strong></div>
          <div className="dx-kv"><span>Tracking Code</span><strong>{event.tracking_code ?? job?.tracking_code ?? '—'}</strong></div>
          {(event.notes || job?.notes) && (
            <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
              <span>Notes</span><strong>{event.notes ?? job?.notes}</strong>
            </div>
          )}
        </div>
        <div className="dx-cal-modal__foot">
          <Link to="/dispatcher/job-orders" className="btn-dx-primary btn-sm" state={{ jobOrderId: event.job_order_id }}>
            View Job Order
          </Link>
          <Link
            to="/dispatcher/dispatch"
            className="btn-dx-secondary btn-sm"
            state={{ jobOrderId: event.job_order_id }}
          >
            View Assignment
          </Link>
          <Link to="/dispatcher/live-tracking" className="btn-dx-secondary btn-sm">
            View Tracking
          </Link>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ summary }) {
  if (!summary) return null
  const items = [
    { label: "Today's Deliveries", value: summary.today_deliveries },
    { label: 'Assigned Deliveries', value: summary.assigned_deliveries },
    { label: 'Completed Deliveries', value: summary.completed_deliveries },
    { label: 'Delayed Deliveries', value: summary.delayed_deliveries },
    { label: 'Issue Reports', value: summary.issue_reports },
    { label: 'Unassigned Job Orders', value: summary.unassigned_jobs },
  ]
  return (
    <div className="dx-panel dx-cal-summary">
      <h3 className="dx-panel-title">Today&apos;s Summary</h3>
      <div className="dx-cal-summary__grid">
        {items.map(({ label, value }) => (
          <div key={label} className="dx-cal-summary__item">
            <span className="dx-cal-summary__value">{value ?? 0}</span>
            <span className="dx-cal-summary__label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingPanel({ upcoming, onSelectJob }) {
  if (!upcoming) return null
  const sections = [
    { key: 'next_deliveries', title: 'Next Deliveries', items: upcoming.next_deliveries ?? [] },
    { key: 'delayed_deliveries', title: 'Delayed Deliveries', items: upcoming.delayed_deliveries ?? [] },
    { key: 'needs_assignment', title: 'Needs Assignment', items: upcoming.needs_assignment ?? [] },
  ]
  return (
    <div className="dx-panel dx-cal-upcoming">
      <h3 className="dx-panel-title">Upcoming Activities</h3>
      <div className="dx-cal-upcoming__body">
        {sections.map(({ key, title, items }) => (
          <div key={key} className="dx-cal-upcoming__section">
            <h4 className="dx-cal-upcoming__heading">{title}</h4>
            {items.length === 0 ? (
              <p className="dx-muted dx-cal-upcoming__empty">None</p>
            ) : (
              items.slice(0, 8).map((item) => (
                <button
                  key={`${key}-${item.job_order_id}`}
                  type="button"
                  className="dx-cal-upcoming__row"
                  onClick={() => onSelectJob(item.job_order_id)}
                >
                  <strong>{item.job_number}</strong>
                  <span>{item.customer_name}</span>
                  <span className="dx-muted" style={{ fontSize: '0.75rem' }}>
                    {formatJobSchedule(item)}
                    {item.driver_name ? ` · ${item.driver_name}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DispatcherCalendarPage() {
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState('month')
  const [rawEvents, setRawEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [filterOptions, setFilterOptions] = useState({ drivers: [], vehicles: [], statuses: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [driverFilter, setDriverFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const rangeBounds = useMemo(() => {
    const start = new Date(calendarDate)
    const end = new Date(calendarDate)
    if (calendarView === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
    } else if (calendarView === 'week') {
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      start.setHours(0, 0, 0, 0)
      end.setTime(start.getTime())
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    }
    return { start, end }
  }, [calendarDate, calendarView])

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCalendarEvents(rangeBounds.start.toISOString(), rangeBounds.end.toISOString())
      setRawEvents(res.events || [])
      setSummary(res.summary || null)
      setUpcoming(res.upcoming || null)
      setConflicts(res.conflicts || [])
      setFilterOptions(res.filters || { drivers: [], vehicles: [], statuses: [] })
    } catch (err) {
      setError(err.message)
      setRawEvents([])
    } finally {
      setLoading(false)
    }
  }, [rangeBounds.start, rangeBounds.end])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rawEvents.filter((ev) => {
      if (driverFilter && String(ev.driver_id) !== String(driverFilter)) return false
      if (vehicleFilter && String(ev.vehicle_id) !== String(vehicleFilter)) return false
      if (statusFilter === 'delayed' && !ev.is_delayed) return false
      if (statusFilter === 'issue_reported' && !ev.has_issue) return false
      if (statusFilter && !['delayed', 'issue_reported'].includes(statusFilter) && ev.status !== statusFilter) return false
      if (rangeStart && new Date(ev.end) < new Date(rangeStart)) return false
      if (rangeEnd && new Date(ev.start) > new Date(`${rangeEnd}T23:59:59`)) return false
      if (q) {
        const hay = [ev.job_number, ev.customer_name, ev.tracking_code].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rawEvents, driverFilter, vehicleFilter, statusFilter, search, rangeStart, rangeEnd])

  const bigCalEvents = useMemo(
    () => filteredEvents.map((ev) => {
      const colors = STATUS_COLORS[ev.category] ?? STATUS_COLORS.assigned
      return {
        ...ev,
        title: `${ev.job_number}\n${ev.customer_name}`,
        start: new Date(ev.start),
        end: new Date(ev.end),
        resource: colors,
      }
    }),
    [filteredEvents],
  )

  const eventStyleGetter = (event) => {
    const c = event.resource ?? STATUS_COLORS.assigned
    return {
      style: {
        backgroundColor: c.bg,
        borderLeft: `4px solid ${c.border}`,
        color: c.text,
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        opacity: event.has_conflict ? 0.95 : 1,
        boxShadow: event.has_conflict ? 'inset 0 0 0 2px #dc2626' : undefined,
      },
    }
  }

  const openEvent = async (event) => {
    setSelectedEvent(event)
    setSelectedJob(null)
    if (!event?.job_order_id) return
    setDetailLoading(true)
    try {
      const job = await fetchJobOrder(event.job_order_id)
      setSelectedJob(job)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const openJobById = async (jobOrderId) => {
    const ev = rawEvents.find((e) => e.job_order_id === jobOrderId)
    if (ev) {
      openEvent(ev)
      return
    }
    setDetailLoading(true)
    try {
      const job = await fetchJobOrder(jobOrderId)
      setSelectedJob(job)
      setSelectedEvent({
        job_order_id: job.id,
        job_number: `JO-${new Date().getFullYear()}-${String(job.id).padStart(3, '0')}`,
        customer_name: buildDisplayName(job) || job.customer_name,
        status: job.status,
        category: job.status,
        start: job.scheduled_start,
        end: job.scheduled_end,
        tracking_code: job.tracking_code,
        pickup_location: buildDisplayAddress('pickup', job) || job.pickup_location,
        dropoff_location: buildDisplayAddress('dropoff', job) || job.dropoff_location,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Dispatcher Calendar"
        subtitle="Scheduling and activity monitoring for delivery planning"
      />
      {error && <p className="notice error">{error}</p>}

      {conflicts.length > 0 && (
        <div className="notice error dx-cal-conflict-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>Schedule Conflict Detected</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.875rem' }}>
              {conflicts.slice(0, 5).map((c, i) => (
                <li key={i}>{c.vehicle_label}: {c.details}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="dx-cal-filters dx-panel">
        <div className="dx-cal-filters__row">
          <label>
            Driver
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
              <option value="">All drivers</option>
              {filterOptions.drivers?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Vehicle
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="">All vehicles</option>
              {filterOptions.vehicles?.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {filterOptions.statuses?.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </label>
          <label className="dx-cal-search">
            Search
            <span className="dx-cal-search__control">
              <Search size={16} aria-hidden />
              <input
                type="search"
                placeholder="Job #, client, tracking code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </label>
        </div>
        <div className="dx-cal-legend">
          {Object.entries(STATUS_COLORS).map(([key, meta]) => (
            <span key={key} className="dx-cal-legend__item">
              <span className="dx-cal-legend__dot" style={{ background: meta.border }} />
              {meta.label}
            </span>
          ))}
        </div>
      </div>

      <div className="dx-cal-layout">
        <div className="dx-cal-main">
          {loading ? (
            <div className="dx-panel dx-cal-loading">Loading calendar…</div>
          ) : rawEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No scheduled activities found."
              message="Adjust filters or create job orders with scheduled dates."
            />
          ) : (
            <div className="dx-panel dx-cal-rbc-wrap">
              <BigCalendar
                localizer={localizer}
                events={bigCalEvents}
                startAccessor="start"
                endAccessor="end"
                view={VIEW_MAP[calendarView] ?? 'month'}
                onView={(v) => setCalendarView(v)}
                date={calendarDate}
                onNavigate={setCalendarDate}
                onSelectEvent={openEvent}
                eventPropGetter={eventStyleGetter}
                popup
                views={['month', 'week', 'day']}
                style={{ height: '100%' }}
                tooltipAccessor={(ev) => `${ev.job_number} · ${ev.customer_name}\nDriver: ${ev.driver_name ?? '—'}\nVehicle: ${ev.vehicle_name ?? '—'}`}
              />
            </div>
          )}
        </div>

        <aside className="dx-cal-sidebar">
          <SummaryCard summary={summary} />
          <UpcomingPanel upcoming={upcoming} onSelectJob={openJobById} />
        </aside>
      </div>

      {selectedEvent && (
        <EventDetailModal
          job={selectedJob}
          event={selectedEvent}
          onClose={() => { setSelectedEvent(null); setSelectedJob(null) }}
        />
      )}
      {detailLoading && (
        <p className="dx-cal-loading-toast">Loading details…</p>
      )}
    </>
  )
}

export default DispatcherCalendarPage
