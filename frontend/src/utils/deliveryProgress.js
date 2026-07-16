import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react'
export const DELIVERY_PROGRESS_STEPS = [
  { key: 'pending', label: 'Pending', icon: Package },
  { key: 'assigned', label: 'Dispatched', icon: CheckCircle2 },
  { key: 'en_route_to_pickup', label: 'En Route to Pickup', icon: Truck },
  { key: 'arrived_at_pickup', label: 'Arrived at Pickup', icon: MapPin },
  { key: 'en_route_to_destination', label: 'Enroute to Destination', icon: Truck },
  { key: 'arrived_at_destination', label: 'Arrived at Destination', icon: MapPin },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
]

/** Map API / job status to active step index (0–6). Returns -1 for cancelled. */
export function deliveryProgressIndex(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  if (s === 'cancelled' || s === 'canceled') return -1
  if (s === 'pending') return 0
  if (s === 'assigned' || s === 'dispatched') return 1
  if (s === 'en_route_to_pickup') return 2
  if (s === 'arrived_at_pickup') return 3
  if (s === 'en_route_to_destination' || s === 'in_progress' || s === 'en_route') return 4
  if (s === 'arrived_at_destination' || s === 'arrived') return 5
  if (s === 'completed' || s === 'delivered') return 6
  return 0
}

export function isDeliveryCancelled(status) {
  const s = String(status || '').toLowerCase()
  return s === 'cancelled' || s === 'canceled'
}
