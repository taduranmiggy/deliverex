import {
  postDelayReport,
  postStatusUpdate,
  postTrackingUpdate,
  uploadCompletionProof,
  uploadDocument,
  uploadIssueReport,
} from '../api/driver'
import { getQueue, replaceQueue } from './offlineQueue'

async function syncCompletionProofItem(item) {
  const {
    assignment_id, proof_type, document_type, receiver_name, receiver_contact,
    delivery_notes, fileName, fileType, fileBase64, signatureName, signatureType, signatureBase64,
  } = item.payload
  const binary = atob(fileBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: fileType || 'image/jpeg' })
  const fd = new FormData()
  fd.append('assignment_id', String(assignment_id))
  fd.append('proof_type', proof_type)
  if (document_type) fd.append('document_type', document_type)
  if (receiver_name) fd.append('receiver_name', receiver_name)
  if (receiver_contact) fd.append('receiver_contact', receiver_contact)
  if (delivery_notes) fd.append('delivery_notes', delivery_notes)
  fd.append('file', blob, fileName || 'proof.jpg')
  if (signatureBase64) {
    const sigBinary = atob(signatureBase64)
    const sigBytes = new Uint8Array(sigBinary.length)
    for (let i = 0; i < sigBinary.length; i += 1) {
      sigBytes[i] = sigBinary.charCodeAt(i)
    }
    const sigBlob = new Blob([sigBytes], { type: signatureType || 'image/png' })
    fd.append('signature', sigBlob, signatureName || 'signature.png')
  }
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
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: fileType || 'image/jpeg' })
    fd.append('photo', blob, fileName || 'issue.jpg')
  }
  await uploadIssueReport(fd)
}

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
      } else if (item.type === 'delay') {
        await postDelayReport(item.payload)
      } else if (item.type === 'completion_proof') {
        await syncCompletionProofItem(item)
      } else if (item.type === 'issue') {
        await syncIssueItem(item)
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
