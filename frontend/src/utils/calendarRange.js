/** Monday as first day of week */
export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfWeek(date) {
  const s = startOfWeek(date)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

export function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Grid range: include leading/trailing days for month calendar */
export function monthGridRange(anchor) {
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const gridStart = startOfWeek(first)
  const gridEnd = endOfWeek(last)
  return { start: gridStart, end: gridEnd }
}

export function viewRange(view, anchor) {
  if (view === 'day') {
    const start = new Date(anchor)
    start.setHours(0, 0, 0, 0)
    const end = new Date(anchor)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (view === 'week') {
    return { start: startOfWeek(anchor), end: endOfWeek(anchor) }
  }
  return monthGridRange(anchor)
}

export function toIso(d) {
  return d.toISOString()
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  )
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

export function formatMonthYear(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatWeekLabel(start, end) {
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`
}

export function formatDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function eventsForDay(events, day) {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(23, 59, 59, 999)
  return events.filter((ev) => {
    const s = new Date(ev.start)
    const e = new Date(ev.end)
    return s <= dayEnd && e >= dayStart
  })
}

export function buildMonthCells(gridStart, gridEnd) {
  const cells = []
  const cur = new Date(gridStart)
  while (cur <= gridEnd) {
    cells.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

export function buildWeekDays(anchor) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
