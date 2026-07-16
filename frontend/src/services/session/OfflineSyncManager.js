import SessionManager from './SessionManager'
import { syncQueue } from '../../utils/syncQueue'
import { getQueue } from '../../utils/offlineQueue'
import { apiRequest } from '../../api/client'
import { buildSessionMeta } from './DeviceSessionManager'

/**
 * FR 1.20 / FR 1.21 — refresh session then flush offline driver queue.
 */
export async function offlineSyncWithRefresh() {
  if (!navigator.onLine) {
    return { refreshed: false, sync: null, remaining: getQueue().length }
  }

  let refreshed = false
  if (SessionManager.isAccessTokenExpiringSoon(60_000)) {
    await SessionManager.refreshAccessToken()
    refreshed = true
  }

  const queue = getQueue()
  if (queue.length > 0) {
    try {
      await apiRequest('/driver/offline-queue', {
        method: 'POST',
        body: JSON.stringify({
          ...buildSessionMeta(),
          items: queue.map((item) => ({
            client_queue_id: item.id,
            action_type: item.type,
            payload: item.payload,
            action_timestamp: item.action_timestamp,
          })),
        }),
      })
    } catch {
      // Non-fatal — local queue still syncs via driver API.
    }
  }

  const sync = queue.length > 0 ? await syncQueue() : { remaining: 0, processed: 0 }

  if ((sync.processed ?? 0) > 0 && queue.length > 0) {
    const ids = queue.slice(0, sync.processed).map((i) => i.id)
    try {
      await apiRequest('/driver/offline-queue/synced', {
        method: 'POST',
        body: JSON.stringify({ client_queue_ids: ids }),
      })
    } catch {
      // ignore
    }
  }

  return { refreshed, sync, remaining: sync?.remaining ?? 0 }
}

export default { offlineSyncWithRefresh }
