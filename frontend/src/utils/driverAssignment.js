/** @returns {Date|null} */
export function getAssignmentLastUpdated(assignment) {
  if (!assignment) return null
  const times = []
  for (const log of assignment.delivery_status_logs ?? []) {
    const t = log.event_at ?? log.created_at
    if (t) times.push(new Date(t).getTime())
  }
  for (const log of assignment.tracking_logs ?? []) {
    const t = log.event_at ?? log.captured_at ?? log.created_at
    if (t) times.push(new Date(t).getTime())
  }
  if (assignment.completed_event_at) times.push(new Date(assignment.completed_event_at).getTime())
  if (!times.length) return null
  return new Date(Math.max(...times))
}

export function formatLastUpdated(assignment) {
  const d = getAssignmentLastUpdated(assignment)
  if (!d) return null
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatJobSchedule(job) {
  if (!job?.scheduled_start && !job?.scheduled_end) {
    return 'Not set'
  }
  const timeOpts = { hour: 'numeric', minute: '2-digit' }
  const dateOpts = { month: 'short', day: 'numeric', ...timeOpts }

  if (job.scheduled_start && job.scheduled_end) {
    const start = new Date(job.scheduled_start)
    const end = new Date(job.scheduled_end)
    if (start.toDateString() === end.toDateString()) {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${start.toLocaleTimeString(undefined, timeOpts)} → ${end.toLocaleTimeString(undefined, timeOpts)}`
    }
    return `${start.toLocaleString(undefined, dateOpts)} → ${end.toLocaleString(undefined, dateOpts)}`
  }

  const single = new Date(job.scheduled_start || job.scheduled_end)
  return single.toLocaleString(undefined, dateOpts)
}

export const DRIVER_STATUS_STEPS = [
  {
    value: 'en_route_to_pickup',
    label: 'Start Pickup',
    description: 'Heading to pickup point',
    allowedFrom: ['assigned'],
  },
  {
    value: 'arrived_at_pickup',
    label: 'Arrived at Pickup',
    description: 'Confirm pickup-site arrival',
    allowedFrom: ['en_route_to_pickup'],
  },
  {
    value: 'en_route_to_destination',
    label: 'Start Delivery',
    description: 'Heading to delivery destination',
    allowedFrom: ['arrived_at_pickup'],
  },
  {
    value: 'arrived',
    label: 'Arrived at Destination',
    description: 'Arrived at destination',
    allowedFrom: ['en_route_to_destination'],
  },
  {
    value: 'completed',
    label: 'Delivered / Completed',
    description: 'Delivery successfully completed',
    allowedFrom: ['arrived'],
  },
]

export function getNextStatusOptions(currentStatus) {
  const normalized = String(currentStatus || '').toLowerCase().trim()
  const canonical = normalized === 'in_progress' ? 'en_route_to_destination' : normalized
  return DRIVER_STATUS_STEPS.filter((step) => step.allowedFrom.includes(canonical))
}

export const ISSUE_TYPES = [
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'flat_tire', label: 'Flat Tire' },
  { value: 'accident', label: 'Accident' },
  { value: 'wrong_material', label: 'Wrong Material' },
  { value: 'site_inaccessible', label: 'Site Inaccessible' },
  { value: 'safety_issue', label: 'Safety Issue' },
  { value: 'other', label: 'Other' },
]

export function getIssueTypeLabel(value) {
  return ISSUE_TYPES.find((t) => t.value === value)?.label ?? value?.replace(/_/g, ' ')
}

export const DELAY_REASONS = [
  { value: 'traffic_congestion', label: 'Traffic Congestion' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'loading_delay', label: 'Loading Delay' },
  { value: 'client_site_not_ready', label: 'Client Site Not Ready' },
  { value: 'weather_condition', label: 'Weather Condition' },
  { value: 'road_closure', label: 'Road Closure' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
]

export function getDelayReasonLabel(value) {
  return DELAY_REASONS.find((r) => r.value === value)?.label ?? value
}
