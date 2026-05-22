import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCalendarEvents, fetchJobOrder } from '../../api/dispatcher'
import { PageHeader, StatusBadge } from '../../components/ui'
import {
  addDays,
  addMonths,
  buildMonthCells,
  buildWeekDays,
  endOfWeek,
  eventsForDay,
  formatDayLabel,
  formatMonthYear,
  formatWeekLabel,
  sameDay,
  startOfMonth,
  toIso,
  viewRange,
} from '../../utils/calendarRange'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import { Calendar, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'

const CATEGORY_META = {
  pending:   { label: 'Pending',   color: '#d97706', bg: '#fef3c7' },
  scheduled: { label: 'Scheduled', color: '#2563eb', bg: '#dbeafe' },
  assigned:  { label: 'Assigned',  color: '#7c3aed', bg: '#ede9fe' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#dcfce7' },
  delayed:   { label: 'Delayed',   color: '#dc2626', bg: '#fee2e2' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: '#f1f5f9' },
  ocr:       { label: 'OCR',       color: '#ea580c', bg: '#ffedd5' },
}

const VIEWS = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
]

function formatEventTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CalendarEventChip({ event, onSelect }) {
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.scheduled
  return (
    <button
      type="button"
      className="dx-cal-event"
      style={{ background: meta.bg, borderColor: meta.color, color: meta.color }}
      onClick={() => onSelect(event)}
      title={`${event.job_number} · ${event.customer_name}`}
    >
      <span className="dx-cal-event__id">{event.job_number}</span>
      <span className="dx-cal-event__client">{event.customer_name}</span>
    </button>
  )
}

function JobDetailModal({ job, event, onClose }) {
  if (!job && !event) return null
  const assignment = job?.assignments?.[0]
  const display = job || event

  return (
    <div className="dx-cal-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dx-cal-modal"
        role="dialog"
        aria-labelledby="cal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dx-cal-modal__head">
          <h2 id="cal-modal-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            {job ? formatJobPublicId(job.id) : event?.job_number}
          </h2>
          <button type="button" className="dx-detail-panel__close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="dx-cal-modal__body">
          {event?.type === 'ocr' && (
            <p className="notice" style={{ marginTop: 0 }}>
              <FileText size={14} style={{ display: 'inline', marginRight: 6 }} />
              {event.title ?? 'Document OCR activity'} — status: {event.status}
            </p>
          )}
          <div className="dx-kv"><span>Client</span><strong>{display.customer_name ?? '—'}</strong></div>
          {job?.customer_contact && (
            <div className="dx-kv"><span>Contact</span><strong>{job.customer_contact}</strong></div>
          )}
          {job && (
            <div className="dx-kv">
              <span>Route</span>
              <strong>{job.pickup_location} → {job.dropoff_location}</strong>
            </div>
          )}
          <div className="dx-kv"><span>Delivery window</span>
            <strong>
              {formatEventTime(display.start ?? job?.scheduled_start)}
              {(display.end ?? job?.scheduled_end) && (
                <> – {formatEventTime(display.end ?? job?.scheduled_end)}</>
              )}
            </strong>
          </div>
          <div className="dx-kv"><span>Status</span>
            <span className={jobStatusBadgeClass(job?.status ?? event?.status)}>
              {formatJobStatus(job?.status ?? event?.status)}
            </span>
            {event?.is_delayed && (
              <span className="badge-dx badge-dx--pending" style={{ marginLeft: 8 }}>Delayed</span>
            )}
          </div>
          <div className="dx-kv"><span>Assigned driver</span>
            <strong>{assignment?.driver?.user?.name ?? event?.driver_name ?? '—'}</strong>
          </div>
          <div className="dx-kv"><span>Assigned vehicle</span>
            <strong>{assignment?.vehicle?.plate_no ?? event?.vehicle_plate ?? '—'}</strong>
          </div>
          {job?.tracking_code && (
            <div className="dx-kv"><span>Tracking code</span><strong>{job.tracking_code}</strong></div>
          )}
          {job?.priority && (
            <div className="dx-kv"><span>Priority</span>
              <strong style={{ textTransform: 'capitalize' }}>{job.priority}</strong>
            </div>
          )}
        </div>
        <div className="dx-cal-modal__foot">
          {(job?.status === 'pending' || event?.status === 'pending') && (
            <Link to="/dispatcher/dispatch-best-fit" className="btn-dx-primary btn-sm">
              Dispatch
            </Link>
          )}
          <Link
            to="/dispatcher/job-orders"
            className="btn-dx-secondary btn-sm"
            state={{ jobOrderId: job?.id ?? event?.job_order_id }}
          >
            Open in Job Orders
          </Link>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function DispatcherCalendarPage() {
  const [view, setView] = useState('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const range = useMemo(() => viewRange(view, anchor), [view, anchor])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCalendarEvents(toIso(range.start), toIso(range.end))
      setEvents(res.events || [])
    } catch (err) {
      setError(err.message)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event)
    setSelectedJob(null)
    if (!event.job_order_id) return
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

  const closeModal = () => {
    setSelectedEvent(null)
    setSelectedJob(null)
  }

  const goToday = () => setAnchor(new Date())

  const goPrev = () => {
    if (view === 'month') setAnchor((d) => addMonths(d, -1))
    else if (view === 'week') setAnchor((d) => addDays(d, -7))
    else setAnchor((d) => addDays(d, -1))
  }

  const goNext = () => {
    if (view === 'month') setAnchor((d) => addMonths(d, 1))
    else if (view === 'week') setAnchor((d) => addDays(d, 7))
    else setAnchor((d) => addDays(d, 1))
  }

  const titleLabel = useMemo(() => {
    if (view === 'month') return formatMonthYear(anchor)
    if (view === 'week') {
      const { start, end } = viewRange('week', anchor)
      return formatWeekLabel(start, end)
    }
    return formatDayLabel(anchor)
  }, [view, anchor])

  const monthCells = view === 'month' ? buildMonthCells(range.start, range.end) : []
  const weekDays = view === 'week' ? buildWeekDays(anchor) : []
  const today = new Date()

  return (
    <>
      <PageHeader
        title="Dispatch Calendar"
        subtitle="Scheduled jobs, assignments, delays, and document OCR activity from live data"
      />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-cal-toolbar">
        <div className="dx-cal-toolbar__nav">
          <button type="button" className="btn-dx-secondary btn-sm" onClick={goPrev} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={goToday}>Today</button>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={goNext} aria-label="Next">
            <ChevronRight size={16} />
          </button>
          <h2 className="dx-cal-toolbar__title">
            <Calendar size={18} aria-hidden />
            {titleLabel}
          </h2>
        </div>
        <div className="dx-cal-toolbar__views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`dx-cal-view-btn${view === v.id ? ' dx-cal-view-btn--active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dx-cal-legend">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <span key={key} className="dx-cal-legend__item">
            <span className="dx-cal-legend__dot" style={{ background: meta.color }} />
            {meta.label}
          </span>
        ))}
      </div>

      {loading && <p className="dx-muted" style={{ marginBottom: 12 }}>Loading calendar…</p>}

      {view === 'month' && (
        <div className="dx-cal-month">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="dx-cal-month__dow">{d}</div>
          ))}
          {monthCells.map((day) => {
            const dayEvents = eventsForDay(events, day)
            const inMonth = day.getMonth() === anchor.getMonth()
            const isToday = sameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={`dx-cal-month__cell${inMonth ? '' : ' dx-cal-month__cell--muted'}${isToday ? ' dx-cal-month__cell--today' : ''}`}
              >
                <span className="dx-cal-month__date">{day.getDate()}</span>
                <div className="dx-cal-month__events">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <CalendarEventChip key={ev.id} event={ev} onSelect={handleSelectEvent} />
                  ))}
                  {dayEvents.length > 3 && (
                    <button
                      type="button"
                      className="dx-cal-more"
                      onClick={() => { setView('day'); setAnchor(new Date(day)) }}
                    >
                      +{dayEvents.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'week' && (
        <div className="dx-cal-week">
          {weekDays.map((day) => {
            const dayEvents = eventsForDay(events, day)
            const isToday = sameDay(day, today)
            return (
              <div key={day.toISOString()} className={`dx-cal-week__col${isToday ? ' dx-cal-week__col--today' : ''}`}>
                <div className="dx-cal-week__head">
                  <span className="dx-cal-week__dow">{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="dx-cal-week__num">{day.getDate()}</span>
                </div>
                <div className="dx-cal-week__body">
                  {dayEvents.length === 0 ? (
                    <p className="dx-cal-empty">No events</p>
                  ) : (
                    dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        className="dx-cal-week-card"
                        style={{
                          borderLeftColor: (CATEGORY_META[ev.category] ?? CATEGORY_META.scheduled).color,
                        }}
                        onClick={() => handleSelectEvent(ev)}
                      >
                        <div className="dx-cal-week-card__top">
                          <strong>{ev.job_number}</strong>
                          <StatusBadge status={ev.is_delayed ? 'delayed' : ev.status} />
                        </div>
                        <p>{ev.customer_name}</p>
                        <p className="dx-cal-week-card__meta">
                          {formatEventTime(ev.start)}
                        </p>
                        <p className="dx-cal-week-card__meta">
                          {ev.driver_name ? `${ev.driver_name}` : 'No driver'}
                          {ev.vehicle_plate ? ` · ${ev.vehicle_plate}` : ''}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="dx-cal-day">
          {eventsForDay(events, anchor).length === 0 ? (
            <div className="dx-panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              No scheduled activity for this day.
            </div>
          ) : (
            eventsForDay(events, anchor)
              .sort((a, b) => new Date(a.start) - new Date(b.start))
              .map((ev) => {
                const meta = CATEGORY_META[ev.category] ?? CATEGORY_META.scheduled
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="dx-cal-day-card"
                    style={{ borderLeftColor: meta.color }}
                    onClick={() => handleSelectEvent(ev)}
                  >
                    <div className="dx-cal-day-card__time">{formatEventTime(ev.start)}</div>
                    <div className="dx-cal-day-card__main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1rem' }}>{ev.job_number}</strong>
                        <span
                          className="dx-cal-legend__item"
                          style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {ev.is_delayed && <StatusBadge status="delayed" />}
                      </div>
                      <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{ev.customer_name}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--muted)' }}>
                        Driver: {ev.driver_name ?? '—'} · Vehicle: {ev.vehicle_plate ?? '—'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Status: {formatJobStatus(ev.status)}
                        {ev.type === 'ocr' && ev.title ? ` · ${ev.title}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={18} style={{ flexShrink: 0, opacity: 0.4 }} />
                  </button>
                )
              })
          )}
        </div>
      )}

      {(selectedEvent || detailLoading) && (
        <JobDetailModal
          job={selectedJob}
          event={selectedEvent}
          onClose={closeModal}
        />
      )}
      {detailLoading && (
        <p className="dx-muted" style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', padding: '8px 16px', borderRadius: 8, boxShadow: 'var(--shadow-md)' }}>
          Loading job details…
        </p>
      )}
    </>
  )
}

export default DispatcherCalendarPage
