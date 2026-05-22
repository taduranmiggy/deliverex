import { postStatusUpdate, postTrackingUpdate, uploadDocument } from '../api/driver'
import { getQueue, replaceQueue } from './offlineQueue'

async function syncDocumentItem(item) {
  const { assignment_id, type, notes, fileName, fileType, fileBase64 } = item.payload
  const binary = atob(fileBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: fileType || 'image/jpeg' })
  const fd = new FormData()
  fd.append('assignment_id', String(assignment_id))
  fd.append('type', type || 'pod')
  if (notes) fd.append('notes', notes)
  fd.append('file', blob, fileName || 'upload.jpg')
  await uploadDocument(fd)
}

export async function syncQueue() {
  const queue = getQueue()
  const remaining = []

  for (const item of queue) {
    try {
      if (item.type === 'status') {
        await postStatusUpdate(item.payload)
      } else if (item.type === 'tracking') {
        await postTrackingUpdate(item.payload)
      } else if (item.type === 'document') {
        await syncDocumentItem(item)
      } else {
        remaining.push(item)
      }
    } catch {
      remaining.push(item)
    }
  }

  replaceQueue(remaining)

  return {
    processed: queue.length - remaining.length,
    remaining: remaining.length,
  }
}
