export function computeJobStats(assignments) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = (iso) => {
    if (!iso) return false
    const d = new Date(iso)
    return d >= today && d < tomorrow
  }

  let jobsToday = 0
  let pending = 0
  let completed = 0

  for (const a of assignments) {
    const sched = a.job_order?.scheduled_start
    if (isToday(sched) || isToday(a.assigned_at)) jobsToday += 1
    if (['assigned', 'in_progress', 'arrived'].includes(a.status)) pending += 1
    if (a.status === 'completed') completed += 1
  }

  return { jobsToday, pending, completed, total: assignments.length }
}

export function getActiveAssignment(assignments) {
  return assignments.find((a) => !['completed', 'cancelled'].includes(a.status)) ?? null
}
