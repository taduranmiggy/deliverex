export const PAST_SCHEDULE_MESSAGE =
  'Cannot create a booking for a past date. Please select today or a future date.'

/** True if datetime-local or ISO value is before now (minute precision). */
export function isPastScheduleValue(value) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return true
  return d.getTime() < Date.now()
}

/**
 * @param {{ scheduled_start?: string, scheduled_end?: string }} fields
 * @returns {Record<string, string>}
 */
export function validateJobSchedule(fields) {
  const errors = {}
  const { scheduled_start: start, scheduled_end: end } = fields

  if (start && isPastScheduleValue(start)) {
    errors.scheduled_start = PAST_SCHEDULE_MESSAGE
  }
  if (end && isPastScheduleValue(end)) {
    errors.scheduled_end = PAST_SCHEDULE_MESSAGE
  }
  if (start && end && !errors.scheduled_start && !errors.scheduled_end) {
    if (new Date(end) < new Date(start)) {
      errors.scheduled_end = 'Scheduled end must be on or after the scheduled start.'
    }
  }

  return errors
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
