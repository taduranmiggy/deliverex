export const PAST_SCHEDULE_MESSAGE =
  'Cannot create a booking for a past date. Please select today or a future date.'

export const SCHEDULE_START_REQUIRED = 'Scheduled date and time is required.'
export const SCHEDULE_END_REQUIRED = 'End date and time is required.'
export const SCHEDULE_END_AFTER_START =
  'End date and time must be after the start date and time.'

/** True if datetime-local or ISO value is before now (minute precision). */
export function isPastScheduleValue(value) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return true
  return d.getTime() < Date.now()
}

/** Convert API datetime to value for `<input type="datetime-local" />` in local time. */
export function toDatetimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * @param {{ scheduled_start?: string, scheduled_end?: string }} fields
 * @param {{ requireBoth?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function validateJobSchedule(fields, options = {}) {
  const errors = {}
  const { scheduled_start: start, scheduled_end: end } = fields
  const { requireBoth = false } = options

  if (requireBoth && !start) {
    errors.scheduled_start = SCHEDULE_START_REQUIRED
  }
  if (requireBoth && !end) {
    errors.scheduled_end = SCHEDULE_END_REQUIRED
  }

  if (start && isPastScheduleValue(start)) {
    errors.scheduled_start = PAST_SCHEDULE_MESSAGE
  }
  if (end && isPastScheduleValue(end)) {
    errors.scheduled_end = PAST_SCHEDULE_MESSAGE
  }
  if (start && end && !errors.scheduled_start && !errors.scheduled_end) {
    const diffMs = new Date(end).getTime() - new Date(start).getTime()
    if (diffMs <= 0) {
      errors.scheduled_end = SCHEDULE_END_AFTER_START
    }
  }

  return errors
}

/** Minimum value for end datetime-local: start or now (legacy forms with end time). */
export function minEndDatetimeLocalValue(start) {
  const pad = (n) => String(n).padStart(2, '0')
  const toLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  const now = new Date()
  const base = start ? new Date(start) : now
  const effective = base.getTime() < now.getTime() ? now : base
  return toLocal(effective)
}

/** Minimum value for <input type="datetime-local" /> (local time, no past times today). */
export function minDatetimeLocalValue() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function firstScheduleError(errors) {
  return errors.scheduled_start || errors.scheduled_end || null
}

/**
 * @returns {{ date: string, time: string }|null}
 */
function formatScheduleReviewPoint(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return {
    date: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  }
}

/**
 * @returns {{ start: { date: string, time: string }|null, end: { date: string, time: string }|null }|null}
 */
export function formatScheduleReviewParts(start, end) {
  if (!start && !end) return null
  return {
    start: formatScheduleReviewPoint(start),
    end: formatScheduleReviewPoint(end),
  }
}
