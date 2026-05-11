import { postStatusUpdate, postTrackingUpdate } from '../api/driver'
import { getQueue, replaceQueue } from './offlineQueue'

export async function syncQueue() {
  const queue = getQueue()
  const remaining = []

  for (const item of queue) {
    try {
      if (item.type === 'status') {
        await postStatusUpdate(item.payload)
      } else if (item.type === 'tracking') {
        await postTrackingUpdate(item.payload)
      } else {
        remaining.push(item)
      }
    } catch (error) {
      remaining.push(item)
    }
  }

  replaceQueue(remaining)

  return {
    processed: queue.length - remaining.length,
    remaining: remaining.length,
  }
}
