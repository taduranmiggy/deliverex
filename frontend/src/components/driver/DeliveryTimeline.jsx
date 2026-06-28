import { formatJobStatus } from '../../utils/statusLabels'
import { CheckCircle2, Circle, Truck } from 'lucide-react'

const STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'en_route_to_pickup', label: 'En Route to Pickup' },
  { key: 'arrived_at_pickup', label: 'Arrived at Pickup' },
  { key: 'en_route_to_destination', label: 'En Route to Destination' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'completed', label: 'Completed' },
]

const RANK = {
  assigned: 1,
  in_progress: 4, // legacy alias
  en_route_to_pickup: 2,
  arrived_at_pickup: 3,
  en_route_to_destination: 4,
  arrived: 5,
  completed: 6,
  cancelled: 0,
}

function stepState(currentStatus, stepKey) {
  if (currentStatus === 'cancelled') return 'cancelled'
  const cur = RANK[currentStatus] ?? 0
  const step = RANK[stepKey] ?? 0
  if (cur > step) return 'done'
  if (cur === step) return 'current'
  return 'upcoming'
}

function DeliveryTimeline({ status = 'assigned' }) {
  return (
    <div className="driver-timeline-steps" aria-label="Delivery timeline">
      {STEPS.map((step, idx) => {
        const state = stepState(status, step.key)
        return (
          <div key={step.key} className={`driver-timeline-step driver-timeline-step--${state}`}>
            <div className="driver-timeline-step__track">
              {idx > 0 && <span className="driver-timeline-step__line" aria-hidden />}
              <span className="driver-timeline-step__icon">
                {state === 'done' ? <CheckCircle2 size={18} /> : state === 'current' ? <Truck size={18} /> : <Circle size={18} />}
              </span>
            </div>
            <div className="driver-timeline-step__text">
              <strong>{step.label}</strong>
              {state === 'current' && (
                <span>{formatJobStatus(status)}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default DeliveryTimeline
