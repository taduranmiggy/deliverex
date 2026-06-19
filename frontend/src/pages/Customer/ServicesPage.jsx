import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, Truck, Workflow, Wrench } from 'lucide-react'

const SUPPORT_EMAIL = 'deliverex.support@gmail.com'
const SUPPORT_PHONE = '(+63) 995-582-0222'

const SERVICES = [
  {
    title: 'Material Hauling',
    description:
      'Transportation of construction materials such as aggregates, sand, gravel, and related resources.',
    icon: Truck,
    color: '#2563eb',
    bg: '#dbeafe',
  },
  {
    title: 'Delivery and Transport',
    description:
      'Coordination and execution of deliveries using company drivers and vehicles.',
    icon: Workflow,
    color: '#0891b2',
    bg: '#cffafe',
  },
  {
    title: 'Site Preparation Support',
    description:
      'Logistics support for site preparation and construction activities.',
    icon: Wrench,
    color: '#7c3aed',
    bg: '#ede9fe',
  },
]

function ServicesPage() {
  return (
    <div className="customer-info-page">
      <section className="customer-info-hero customer-info-hero--services">
        <div className="customer-info-hero__inner">
          <p className="tracking-eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>Services</p>
          <h1>Construction logistics you can coordinate and track</h1>
          <p>
            Deliverex supports operational logistics for construction and site delivery requirements
            — from material hauling to proof-of-delivery verification.
          </p>
          <div className="customer-info-hero__actions">
            <Link to="/customer" className="btn-dx-primary btn-sm">Contact Support</Link>
            <Link to="/customer/track" className="customer-info-hero__ghost-btn">
              <MapPin size={15} /> Track Delivery
            </Link>
          </div>
        </div>
      </section>

      <div className="customer-info-body">
        <div className="customer-service-grid">
          {SERVICES.map(({ title, description, icon: Icon, color, bg }, index) => (
            <article
              key={title}
              className="customer-service-card"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="customer-service-card__icon" style={{ background: bg, color }}>
                <Icon size={22} aria-hidden />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <section className="customer-contact-card">
          <div>
            <p className="customer-contact-card__kicker">Get in touch</p>
            <h2>Contact Information</h2>
            <p className="customer-contact-card__desc">
              Reach our support team for delivery inquiries, service requests, and account assistance.
            </p>
          </div>
          <div className="customer-contact-card__channels">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="customer-contact-channel">
              <span className="customer-contact-channel__icon"><Mail size={18} /></span>
              <span>
                <small>Email</small>
                <strong>{SUPPORT_EMAIL}</strong>
              </span>
            </a>
            <a href="tel:+639955820222" className="customer-contact-channel">
              <span className="customer-contact-channel__icon"><Phone size={18} /></span>
              <span>
                <small>Phone</small>
                <strong>{SUPPORT_PHONE}</strong>
              </span>
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ServicesPage
