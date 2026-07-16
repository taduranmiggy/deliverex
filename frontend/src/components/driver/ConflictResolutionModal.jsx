import { useState } from 'react'
import { postStatusUpdate, resolveSyncConflict } from '../api/driver'
import { formatJobStatus } from '../utils/statusLabels'
import { AlertTriangle, CheckCircle2, GitMerge, Server } from 'lucide-react'

export default function ConflictResolutionModal({ conflict, queueItem, onResolved, onClose }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mergeStatus, setMergeStatus] = useState(conflict?.client_version?.status ?? '')

  if (!conflict) return null

  const server = conflict.server_version ?? {}
  const client = conflict.client_version ?? {}
  const changedFields = conflict.changed_fields ?? ['status']

  const persistResolution = async (resolution, extra = {}) => {
    setSubmitting(true)
    setError('')
    try {
      await resolveSyncConflict({
        action_type: queueItem?.type ?? 'status',
        entity_type: 'App\\Models\\DispatchAssignment',
        entity_id: conflict.assignment_id,
        server_version: server,
        client_version: client,
        changed_fields: changedFields,
        resolution,
        client_action_at: client.action_timestamp ?? queueItem?.action_timestamp ?? null,
      })

      if (resolution === 'keep_local' && queueItem?.payload) {
        await postStatusUpdate({
          ...queueItem.payload,
          expected_current_status: server.status,
          action_timestamp: queueItem.action_timestamp,
        })
      }

      if (resolution === 'manual_merge' && extra.merged_status && queueItem?.payload) {
        await postStatusUpdate({
          ...queueItem.payload,
          status: extra.merged_status,
          expected_current_status: server.status,
          action_timestamp: queueItem.action_timestamp,
        })
      }

      onResolved?.({ resolution, queueItem })
    } catch (err) {
      setError(err.message || 'Unable to resolve conflict.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
            Sync Conflict
          </h2>
          <button type="button" className="dx-modal-close" onClick={onClose} disabled={submitting}>×</button>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9375rem' }}>
            This delivery was changed on the server while you were offline. Review both versions and choose how to continue.
          </p>

          <div className="dx-grid-2 dx-grid-2--10">
            <div className="dx-conflict-card">
              <div className="dx-conflict-card__title"><Server size={14} /> Server Version</div>
              <strong>{formatJobStatus(server.status)}</strong>
              <p className="dx-conflict-card__meta">Updated {server.updated_at ? new Date(server.updated_at).toLocaleString() : '—'}</p>
            </div>
            <div className="dx-conflict-card dx-conflict-card--client">
              <div className="dx-conflict-card__title"><CheckCircle2 size={14} /> Offline Version</div>
              <strong>{formatJobStatus(client.status)}</strong>
              <p className="dx-conflict-card__meta">
                Action {client.action_timestamp ? new Date(client.action_timestamp).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <div className="dx-conflict-fields">
            <span className="dx-conflict-fields__label">Changed fields</span>
            <div>{changedFields.map((field) => (
              <span key={field} className="badge-dx badge-dx--muted">{field}</span>
            ))}</div>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitMerge size={14} /> Manual merge status
            </span>
            <select value={mergeStatus} onChange={(e) => setMergeStatus(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--stroke)' }}>
              {[server.status, client.status].filter(Boolean).map((status) => (
                <option key={status} value={status}>{formatJobStatus(status)}</option>
              ))}
            </select>
          </label>

          {error && <p className="notice error" style={{ margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-dx-primary" disabled={submitting} onClick={() => persistResolution('keep_server')}>
              Keep Server
            </button>
            <button type="button" className="btn-dx-secondary" disabled={submitting} onClick={() => persistResolution('keep_local')}>
              Keep Local
            </button>
            <button
              type="button"
              className="btn-dx-secondary"
              disabled={submitting || !mergeStatus}
              onClick={() => persistResolution('manual_merge', { merged_status: mergeStatus })}
            >
              Apply Merge
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
