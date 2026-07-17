import { Link } from 'react-router-dom'
import {
  CheckCircle2, ClipboardList, FileCheck2, MapPin, Radar, Route, Truck, Warehouse,
} from 'lucide-react'
import {
  MotionButton,
  MotionCard,
  MotionCounter,
  MotionIcon,
  MotionSection,
  MotionStagger,
  MotionStaggerItem,
} from '../../motion'

const SYSTEM_FEATURES = [
  { label: 'Delivery Management', icon: ClipboardList, color: '#2563eb', bg: '#dbeafe' },
  { label: 'Fleet Dispatch', icon: Truck, color: '#0891b2', bg: '#cffafe' },
  { label: 'Delivery Tracking', icon: Radar, color: '#7c3aed', bg: '#ede9fe' },
  { label: 'OCR Processing', icon: FileCheck2, color: '#059669', bg: '#d1fae5' },
  { label: 'Proof of Delivery', icon: CheckCircle2, color: '#d97706', bg: '#fef3c7' },
  { label: 'Delivery History', icon: Route, color: '#dc2626', bg: '#fee2e2' },
  { label: 'Reporting', icon: Warehouse, color: '#4f46e5', bg: '#e0e7ff' },
]

function AboutUsPage() {
  return (
    <div className="customer-info-page">
      <section className="customer-info-hero">
        <MotionStagger className="customer-info-hero__inner">
          <MotionStaggerItem index={0}>
            <p className="tracking-eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>About Deliverex</p>
          </MotionStaggerItem>
          <MotionStaggerItem index={1}>
            <h1>Logistics operations built for site delivery teams</h1>
          </MotionStaggerItem>
          <MotionStaggerItem index={2}>
            <p>
              Deliverex is a logistics dispatch, delivery tracking, and OCR-enabled delivery management
              system developed for Providential 628 Site Preparation Services.
            </p>
            <p className="customer-info-hero__sub">
              The system helps manage deliveries, dispatch drivers and vehicles, track delivery
              progress, process proof-of-delivery documents, and maintain delivery records.
            </p>
          </MotionStaggerItem>
          <MotionStaggerItem index={3}>
            <div className="customer-info-hero__actions">
              <MotionButton as={Link} to="/customer/track" className="btn-dx-primary btn-sm">
                <MapPin size={15} /> Track a Delivery
              </MotionButton>
              <MotionButton as={Link} to="/customer/services" className="customer-info-hero__ghost-btn">
                View Services
              </MotionButton>
            </div>
          </MotionStaggerItem>
        </MotionStagger>
      </section>

      <div className="customer-info-body">
        <MotionSection className="customer-info-card">
          <div className="dx-section-header">
            <div>
              <h2>What The System Does</h2>
              <p>Core capabilities that support dispatch, delivery, and verification workflows.</p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: '0.9375rem' }}>
                <MotionCounter value={SYSTEM_FEATURES.length} suffix=" core modules" />
              </p>
            </div>
          </div>
          <div className="customer-feature-grid customer-feature-grid--motion">
            {SYSTEM_FEATURES.map(({ label, icon: Icon, color, bg }, index) => (
              <MotionCard key={label} index={index} className="customer-feature-item" hover>
                <MotionIcon>
                  <div className="customer-feature-item__icon" style={{ background: bg, color }}>
                    <Icon size={20} aria-hidden />
                  </div>
                </MotionIcon>
                <div className="customer-feature-item__content">
                  <CheckCircle2 size={14} className="customer-feature-item__check" aria-hidden />
                  <span>{label}</span>
                </div>
              </MotionCard>
            ))}
          </div>
        </MotionSection>
      </div>
    </div>
  )
}

export default AboutUsPage
