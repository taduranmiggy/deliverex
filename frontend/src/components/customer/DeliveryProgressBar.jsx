import { DELIVERY_PROGRESS_STEPS, deliveryProgressIndex, isDeliveryCancelled } from '../../utils/deliveryProgress'

function DeliveryProgressBar({ status, showStepNumbers = false, layout = 'horizontal' }) {
  const currentIdx = deliveryProgressIndex(status)
  const stacked = layout === 'stacked'

  if (isDeliveryCancelled(status)) {
    return (
      <div className="tracking-alert" role="status">
        This delivery has been cancelled.
      </div>
    )
  }

  return (
    <div className={`pwa-delivery-progress${stacked ? ' pwa-delivery-progress--stacked' : ''}`} aria-label="Delivery progress">
      <div className={`pwa-delivery-progress__track pwa-delivery-progress__track--seven${stacked ? ' pwa-delivery-progress__track--stacked' : ''}`}>
        {DELIVERY_PROGRESS_STEPS.map((step, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          const Icon = step.icon
          return (
            <div key={step.key} className="pwa-delivery-progress__step">
              {idx < DELIVERY_PROGRESS_STEPS.length - 1 && (
                <div
                  className={`pwa-delivery-progress__connector${done ? ' pwa-delivery-progress__connector--done' : ''}`}
                  aria-hidden
                />
              )}
              <div
                className={[
                  'pwa-delivery-progress__dot',
                  done || active ? 'pwa-delivery-progress__dot--done' : '',
                  active ? 'pwa-delivery-progress__dot--active pwa-timeline-step--active' : '',
                ].filter(Boolean).join(' ')}
              >
                {showStepNumbers && !done && !active ? (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: active ? '#fff' : '#94a3b8' }}>
                    {idx + 1}
                  </span>
                ) : (
                  <Icon size={showStepNumbers ? 14 : 16} color={done || active ? '#fff' : 'var(--muted)'} />
                )}
              </div>
              <span className={`pwa-delivery-progress__label${active ? ' pwa-delivery-progress__label--active' : ''}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DeliveryProgressBar
