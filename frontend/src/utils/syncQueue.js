import {
  postDelayReport,
  postStatusUpdate,
  postTrackingUpdate,
  uploadCompletionProof,
  uploadDocument,
  uploadIssueReport,
} from '../api/driver'
import { addConflict, getQueue, replaceQueue } from './offlineQueue'

// ─── Constants ────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3
let pendingConflict = null

export function getPendingConflict() {
  return pendingConflict
}

export function clearPendingConflict() {
  pendingConflict = null
}

function isConflictError(err) {
  if (err?.status === 409 || err?.conflict) return true
  const msg = (err?.message ?? '').toLowerCase()
  return (
    msg.includes('409') ||
    msg.includes('sync conflict')
  )
}

// ─── Item sync helpers ────────────────────────────────────────────

async function syncCompletionProofItem(item) {
  const {
    assignment_id, proof_type, document_type, receiver_name, receiver_contact,
    delivery_notes, fileName, fileType, fileBase64, signatureName, signatureType, signatureBase64,
  } = item.payload
  const binary = atob(fileBase64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: fileType || 'image/jpeg' })
  const fd   = new FormData()
  fd.append('assignment_id', String(assignment_id))
  fd.append('proof_type', proof_type)
  if (document_type)    fd.append('document_type',   document_type)
  if (receiver_name)    fd.append('receiver_name',    receiver_name)
  if (receiver_contact) fd.append('receiver_contact', receiver_contact)
  if (delivery_notes)   fd.append('delivery_notes',   delivery_notes)
  fd.append('file', blob, fileName || 'proof.jpg')
  if (signatureBase64) {
    const sigBinary = atob(signatureBase64)
    const sigBytes  = new Uint8Array(sigBinary.length)
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i)
    fd.append('signature', new Blob([sigBytes], { type: signatureType || 'image/png' }), signatureName || 'signature.png')
  }
  if (item.action_timestamp) fd.append('action_timestamp', item.action_timestamp)
  await uploadCompletionProof(fd)
}

async function syncIssueItem(item) {
  const { assignment_id, issue_type, notes, fileName, fileType, fileBase64 } = item.payload
  const fd = new FormData()
  fd.append('assignment_id', String(assignment_id))
  fd.append('issue_type', issue_type)
  if (notes) fd.append('notes', notes)
  if (fileBase64) {
    const binary = atob(fileBase64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    fd.append('photo', new Blob([bytes], { type: fileType || 'image/jpeg' }), fileName || 'issue.jpg')
  }
  if (item.action_timestamp) fd.append('action_timestamp', item.action_timestamp)
  await uploadIssueReport(fd)
}

async function syncDocumentItem(item) {
  const { assignment_id, type, notes, fileName, fileType, fileBase64 } = item.payload
  const binary = atob(fileBase64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const fd = new FormData()
  fd.append('assignment_id', String(assignment_id))
  fd.append('type', type || 'pod')
  if (notes) fd.append('notes', notes)
  fd.append('file', new Blob([bytes], { type: fileType || 'image/jpeg' }), fileName || 'upload.jpg')
  if (item.action_timestamp) fd.append('action_timestamp', item.action_timestamp)
  await uploadDocument(fd)
}

// ─── Main sync runner ─────────────────────────────────────────────

/**
 * Process all items in the offline queue, in FIFO order.
 *
 * Outcome per item:
 *  - Success       → removed from queue
 *  - Conflict/4xx  → logged to conflict log, removed from queue (server wins)
 *  - Max retries   → logged as exhausted, removed from queue
 *  - Network error → kept in queue with incremented attempt_count
 *
 * @returns {{ processed: number, remaining: number, conflicts: number, synced_at: string }}
 */
export async function syncQueue() {
  const queue     = getQueue()
  const remaining = []
  let processed   = 0
  let conflicts   = 0
  const syncedAt  = new Date().toISOString()

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'status':
          await postStatusUpdate({
            ...item.payload,
            expected_current_status: item.payload.expected_current_status ?? item.payload.previous_status,
            action_timestamp: item.action_timestamp ?? item.queued_at,
          })
          break
        case 'tracking':
          await postTrackingUpdate({
            ...item.payload,
            captured_at: item.action_timestamp ?? item.payload?.captured_at ?? item.queued_at,
            action_timestamp: item.action_timestamp ?? item.queued_at,
          })
          break
        case 'document':
          await syncDocumentItem(item)
          break
        case 'delay':
          await postDelayReport({
            ...item.payload,
            action_timestamp: item.action_timestamp ?? item.queued_at,
          })
          break
        case 'completion_proof':
          await syncCompletionProofItem(item)
          break
        case 'issue':
          await syncIssueItem(item)
          break
        default:
          // Unknown type — keep in queue, don't count as error
          remaining.push(item)
          continue
      }
      processed++
    } catch (err) {
      const attempts = (item.attempt_count ?? 0) + 1

      if (isConflictError(err)) {
        pendingConflict = {
          queue_item: item,
          conflict: err.conflict ?? {
            server_version: {},
            client_version: {
              status: item.payload?.status,
              action_timestamp: item.action_timestamp,
            },
            changed_fields: ['status'],
            assignment_id: item.payload?.assignment_id,
          },
          server_error: err.message,
        }
        remaining.push(item)
        conflicts++
        break
      }

      const shouldDrop = (err?.status >= 400 && err?.status < 500 && err?.status !== 409) || attempts >= MAX_ATTEMPTS

      if (shouldDrop) {
        // Log the conflict for audit purposes
        addConflict({
          queue_item_id:  item.id,
          type:           item.type,
          payload_summary: {
            assignment_id: item.payload?.assignment_id,
            status:        item.payload?.status,
            issue_type:    item.payload?.issue_type,
            delay_reason:  item.payload?.delay_reason,
          },
          action_timestamp: item.action_timestamp,
          queued_at:        item.queued_at,
          attempt_count:    attempts,
          server_error:     err.message,
          resolution:       err?.status === 409 ? 'pending_resolution' : 'max_retries_exceeded',
          synced_at:        syncedAt,
        })
        conflicts++
      } else {
        // Transient / network error: keep for next retry
        remaining.push({
          ...item,
          attempt_count:   attempts,
          last_error:      err.message,
          last_attempt_at: syncedAt,
        })
      }
    }
  }

  replaceQueue(remaining)

  return { processed, remaining: remaining.length, conflicts, synced_at: syncedAt, pendingConflict: getPendingConflict() }
}
