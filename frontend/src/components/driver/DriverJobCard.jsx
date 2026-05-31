import { Link } from 'react-router-dom'
import { Calendar, Car, ChevronRight, MapPin } from 'lucide-react'
import DriverStatusChip from './DriverStatusChip'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobSchedule } from '../../utils/driverAssignment'

function DriverJobCard({ assignment, showCta = true }) {
  const job = assignment.job_order
  return (
    <Link to={`/driver/jobs/${assignment.id}`} className="da-job-card">
      <div className="da-job-card__head">
        <span className="da-job-card__id">{formatJobPublicId(assignment.job_order_id)}</span>
        <DriverStatusChip status={assignment.status} />
      </div>
      <p className="da-job-card__client">{job?.customer_name ?? 'Client'}</p>
      <p className="da-job-card__row">
        <MapPin size={16} />
        {job?.dropoff_location ?? '—'}
      </p>
      <p className="da-job-card__row">
        <Calendar size={16} />
        {formatJobSchedule(job)}
      </p>
      {assignment.vehicle?.plate_no && (
        <p className="da-job-card__row">
          <Car size={16} />
          {assignment.vehicle.plate_no}
          {assignment.vehicle.type ? ` · ${assignment.vehicle.type}` : ''}
        </p>
      )}
      {showCta && (
        <span className="da-job-card__cta">
          View Details <ChevronRight size={16} />
        </span>
      )}
    </Link>
  )
}

export default DriverJobCard
