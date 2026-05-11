const STORAGE_KEY = 'deliverex_offline_queue'

export function getQueue() {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function enqueue(item) {
  const queue = getQueue()
  queue.push({ ...item, queuedAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  return queue
}

export function clearQueue() {
  localStorage.removeItem(STORAGE_KEY)
}

export function replaceQueue(nextQueue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextQueue))
}
