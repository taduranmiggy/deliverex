import { formatJobStatus } from '../../utils/statusLabels'

const CHIP_CLASS = {
  assigned: 'da-chip--assigned',
  in_progress: 'da-chip--in_progress',
  arrived: 'da-chip--arrived',
  completed: 'da-chip--completed',
  cancelled: 'da-chip--cancelled',
  pending: 'da-chip--pending',
  available: 'da-chip--completed',
  busy: 'da-chip--in_progress',
  offline: 'da-chip--pending',
}

function DriverStatusChip({ status, label }) {
  const cls = CHIP_CLASS[status] ?? 'da-chip--pending'
  const text = label ?? formatJobStatus(status)
  return <span className={`da-chip ${cls}`}>{text}</span>
}

export default DriverStatusChip
