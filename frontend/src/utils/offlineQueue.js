const QUEUE_KEY     = 'deliverex_offline_queue'
const CONFLICT_KEY  = 'deliverex_conflict_log'
const MAX_CONFLICTS = 50

function uid() {
  return `dxq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── Queue ────────────────────────────────────────────────────────

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch { return [] }
}

/**
 * Enqueue an offline action.
 * @param {object} item  Must have { type, payload }.
 *                       Optionally include action_timestamp (ISO string) — defaults to now.
 */
export function enqueue(item) {
  const now   = new Date().toISOString()
  const queue = getQueue()
  const entry = {
    id:               uid(),
    type:             item.type,
    payload:          item.payload,
    // action_timestamp = moment driver performed the action (preserved for server)
    action_timestamp: item.action_timestamp ?? now,
    // queued_at = moment it was stored (may differ when date/time set changes)
    queued_at:        now,
    attempt_count:    0,
    last_error:       null,
  }
  queue.push(entry)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  _registerBackgroundSync()
  return queue
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function replaceQueue(nextQueue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(nextQueue))
}

// ─── Conflict log ─────────────────────────────────────────────────

export function getConflictLog() {
  try {
    return JSON.parse(localStorage.getItem(CONFLICT_KEY) || '[]')
  } catch { return [] }
}

/**
 * Append a conflict entry.
 * Automatically trims to MAX_CONFLICTS entries (newest first).
 */
export function addConflict(entry) {
  const log = getConflictLog()
  log.unshift({ id: `dxc_${Date.now()}`, logged_at: new Date().toISOString(), ...entry })
  if (log.length > MAX_CONFLICTS) log.length = MAX_CONFLICTS
  localStorage.setItem(CONFLICT_KEY, JSON.stringify(log))
}

export function clearConflictLog() {
  localStorage.removeItem(CONFLICT_KEY)
}

// ─── Background Sync registration ─────────────────────────────────

function _registerBackgroundSync() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return
  navigator.serviceWorker.ready
    .then((reg) => reg.sync.register('deliverex-offline-queue'))
    .catch(() => {}) // silently ignore — not all browsers support Background Sync
}
