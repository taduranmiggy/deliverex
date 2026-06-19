import { Link } from 'react-router-dom'
import {
  CheckCircle2, ClipboardList, FileCheck2, MapPin, Radar, Route, Truck, Warehouse,
} from 'lucide-react'

const SYSTEM_FEATURES = [
  { label: 'Job Order Management', icon: ClipboardList, color: '#2563eb', bg: '#dbeafe' },
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
        <div className="customer-info-hero__inner">
          <p className="tracking-eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>About Deliverex</p>
          <h1>Logistics operations built for site delivery teams</h1>
          <p>
            Deliverex is a logistics dispatch, delivery tracking, and OCR-enabled delivery management
            system developed for Providential 628 Site Preparation Services.
          </p>
          <p className="customer-info-hero__sub">
            The system helps manage job orders, dispatch drivers and vehicles, track delivery
            progress, process proof-of-delivery documents, and maintain delivery records.
          </p>
          <div className="customer-info-hero__actions">
            <Link to="/customer/track" className="btn-dx-primary btn-sm">
              <MapPin size={15} /> Track a Delivery
            </Link>
            <Link to="/customer/services" className="customer-info-hero__ghost-btn">
              View Services
            </Link>
          </div>
        </div>
      </section>

      <div className="customer-info-body">
        <section className="customer-info-card">
          <div className="dx-section-header">
            <div>
              <h2>What The System Does</h2>
              <p>Core capabilities that support dispatch, delivery, and verification workflows.</p>
            </div>
          </div>
          <div className="customer-feature-grid">
            {SYSTEM_FEATURES.map(({ label, icon: Icon, color, bg }, index) => (
              <div
                key={label}
                className="customer-feature-item"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="customer-feature-item__icon" style={{ background: bg, color }}>
                  <Icon size={20} aria-hidden />
                </div>
                <div className="customer-feature-item__content">
                  <CheckCircle2 size={14} className="customer-feature-item__check" aria-hidden />
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default AboutUsPage
