import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJobOrder } from '../api/dispatcher'
import JobOrderRouteMap from './JobOrderRouteMap'
import { buildDisplayName } from '../utils/jobOrderHelpers'
import { formatJobSchedule } from '../utils/driverAssignment'
import { formatJobPublicId } from '../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../utils/statusLabels'
import { Loader2 } from 'lucide-react'

export default function JobOrderViewModal({
  order,
  onClose,
  onEdit,
  onDelete,
}) {
  const [detail, setDetail] = useState(order)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!order?.id) return undefined
    let cancelled = false
    setDetail(order)
    setLoading(true)

    fetchJobOrder(order.id)
      .then((res) => {
        if (cancelled) return
        const full = res?.data && typeof res.data === 'object' ? res.data : res
        if (full) setDetail(full)
      })
      .catch(() => {
        if (!cancelled) setDetail(order)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [order])

  if (!order) return null

  const assignment = detail?.assignments?.[0]
  const clientName = detail?.client?.client_name || detail?.custom_client_name || buildDisplayName(detail)

  const kv = (label, value) => (
    <div className="dx-kv" key={label}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )

  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div
        className="dx-modal dx-job-view-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="job-view-modal-title"
      >
        <div className="dx-modal-header dx-job-view-modal__header">
          <div className="dx-job-view-modal__title-row">
            <h2 id="job-view-modal-title">{formatJobPublicId(detail?.id ?? order.id)}</h2>
            <span className={jobStatusBadgeClass(detail?.status ?? order.status)}>
              {formatJobStatus(detail?.status ?? order.status)}
            </span>
          </div>
          <button type="button" className="dx-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="dx-job-view-modal__body">
          {loading ? (
            <div className="dx-job-view-modal__loading" aria-busy="true">
              <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite' }} />
              <span>Loading job details…</span>
            </div>
          ) : (
            <>
              <JobOrderRouteMap
                key={detail?.id ?? order.id}
                jobOrderId={detail?.id ?? order.id}
                variant="modal"
                readOnly
              />

              <div className="dx-job-view-modal__details">
                {kv('Client', clientName)}
                {kv('Contact', detail?.customer_contact ?? detail?.customer_email)}
                {detail?.material_type && kv(
                  'Material',
                  `${detail.material_type}${detail.specification_size ? ` · ${detail.specification_size}` : ''}`,
                )}
                {kv(
                  'Load',
                  detail?.load_volume_m3 || detail?.volume_m3
                    ? `${detail.load_volume_m3 ?? detail.volume_m3} m³`
                    : null,
                )}
                {kv('Schedule', formatJobSchedule(detail))}
                {kv('Priority', detail?.priority ? detail.priority.charAt(0).toUpperCase() + detail.priority.slice(1) : null)}
                {kv('Tracking', detail?.tracking_code)}
                {kv('Driver', assignment?.driver?.user?.name)}
                {kv('Vehicle', assignment?.vehicle?.plate_no)}
                {detail?.job_requirements && (
                  <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                    <span>Handling</span>
                    <strong>{detail.job_requirements}</strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!loading && (
          <div className="dx-job-view-modal__footer">
            <button
              type="button"
              className="btn-dx-secondary"
              onClick={() => onEdit?.(detail ?? order)}
            >
              Edit
            </button>
            {(detail?.status ?? order.status) === 'pending' && (
              <Link
                to="/dispatcher/dispatch"
                state={{ jobOrderId: detail?.id ?? order.id }}
                className="btn-dx-primary"
                onClick={onClose}
              >
                Dispatch
              </Link>
            )}
            {['pending', 'cancelled'].includes(detail?.status ?? order.status) && (
              <button
                type="button"
                className="dx-job-view-modal__delete"
                onClick={() => onDelete?.(detail ?? order)}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
