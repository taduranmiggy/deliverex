import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendInquiry } from '../api/customer'
import DeliverexAssistantChat from '../components/DeliverexAssistantChat'
import DeliverexSiteFooter from '../components/customer/DeliverexSiteFooter'
import InquiryForm from '../components/customer/InquiryForm'
import PublicFaqSection from '../components/customer/PublicFaqSection'
import PublicSiteNavBar from '../components/customer/PublicSiteNavBar'
import {
  MotionBackground,
  MotionButton,
  MotionCard,
  MotionFloatingCard,
  MotionHeroVisual,
  MotionModal,
  MotionPage,
  MotionParallax,
  MotionSection,
  MotionStagger,
  MotionStaggerItem,
} from '../motion'
import {
  ArrowRight, CheckCircle2, FileCheck2, HeadphonesIcon, History,
  MessageSquare, Package, Search, X,
} from 'lucide-react'

function LandingHeroArt() {
  return (
    <svg className="landing-hero-art" viewBox="0 0 400 320" role="img" aria-labelledby="landing-hero-art-title">
      <title id="landing-hero-art-title">Deliverex logistics dashboard illustration</title>
      <defs>
        <linearGradient id="landingArtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.78)" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="160" r="130" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      <circle cx="200" cy="160" r="96" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <g fill="url(#landingArtGrad)">
        <circle cx="88" cy="118" r="24" opacity="0.95" />
        <circle cx="68" cy="198" r="18" opacity="0.88" />
        <circle cx="128" cy="212" r="16" opacity="0.82" />
      </g>
      <path
        d="M112 122 L188 134 M92 188 L194 158 M132 198 L198 168"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="198" y="88" width="148" height="112" rx="12" fill="rgba(255,255,255,0.92)" />
      <rect x="216" y="108" width="64" height="8" rx="2" fill="#2563eb" opacity="0.85" />
      <rect x="216" y="124" width="108" height="6" rx="2" fill="#94a3b8" opacity="0.55" />
      <rect x="216" y="138" width="80" height="6" rx="2" fill="#94a3b8" opacity="0.4" />
      <rect x="216" y="158" width="52" height="24" rx="5" fill="#2563eb" opacity="0.2" />
      <rect x="248" y="196" width="56" height="28" rx="6" fill="#2563eb" opacity="0.35" />
      <circle cx="262" cy="228" r="6" fill="#1e3a8a" />
      <circle cx="288" cy="228" r="6" fill="#1e3a8a" />
    </svg>
  )
}

const FLOATING_CARDS = [
  { label: 'Status', value: 'En route', className: 'landing-hero__float-card--1' },
  { label: 'ETA', value: '14 min', className: 'landing-hero__float-card--2' },
  { label: 'POD', value: 'Verified', className: 'landing-hero__float-card--3' },
]

const FEATURES = [
  { Icon: Package, title: 'Delivery Tracking', desc: 'Look up shipment status and delivery progress with a Tracking ID.' },
  { Icon: FileCheck2, title: 'Proof of Delivery', desc: 'View delivery confirmation and document updates after completion.' },
  { Icon: History, title: 'Delivery History', desc: 'Signed-in company users can review previous deliveries in one place.' },
  { Icon: HeadphonesIcon, title: 'Customer Support', desc: 'Contact the support team for delivery, account, and tracking help.' },
]

function LandingPage() {
  const navigate = useNavigate()
  const [trackCode, setTrackCode] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactSent, setContactSent] = useState(false)

  const handleTrack = (e) => {
    e.preventDefault()
    if (trackCode.trim()) {
      navigate('/customer/track', { state: { prefillTracking: trackCode.trim() } })
    }
  }

  return (
    <MotionPage style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <PublicSiteNavBar />

      <section
        className="landing-hero"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #2563eb 100%)',
          padding: 'clamp(60px, 10vw, 120px) 24px',
          color: '#fff',
        }}
      >
        <MotionBackground variant="hero" />
        <div className="landing-hero__inner">
          <MotionStagger className="landing-hero__copy" style={{ textAlign: 'center' }}>
            <MotionStaggerItem index={0}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: '5px 16px', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 24, backdropFilter: 'blur(10px)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
                Trusted logistics tracking for construction & site services
              </div>
            </MotionStaggerItem>

            <MotionStaggerItem index={1}>
              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 20, color: '#fff' }}>
                Track Your Delivery
              </h1>
            </MotionStaggerItem>

            <MotionStaggerItem index={2}>
              <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.65 }}>
                Enter your Tracking ID to view delivery status, estimated arrival, and proof-of-delivery updates.
              </p>
            </MotionStaggerItem>

            <MotionStaggerItem index={3}>
              <form onSubmit={handleTrack} style={{ display: 'flex', gap: 10, maxWidth: 520, margin: '0 auto 20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
                  <input
                    value={trackCode}
                    onChange={(e) => setTrackCode(e.target.value)}
                    placeholder="Enter tracking ID…"
                    className="motion-focus-glow"
                    style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1rem', backdropFilter: 'blur(10px)', outline: 'none' }}
                  />
                </div>
                <MotionButton
                  type="submit"
                  className="btn-dx-primary"
                  style={{ padding: '14px 28px', borderRadius: 14, background: '#fff', color: '#1e3a8a', border: 'none', fontWeight: 800, fontSize: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                >
                  Track Now
                </MotionButton>
              </form>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem' }}>No account required · Example: XKFP2NQRLA</p>
            </MotionStaggerItem>

            <MotionStaggerItem index={4}>
              <div className="landing-hero__actions" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
                <MotionButton type="button" onClick={() => setChatOpen(true)} className="btn-dx-secondary" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                  <MessageSquare size={15} /> Open Assistant
                </MotionButton>
                <MotionButton type="button" onClick={() => setContactOpen(true)} className="btn-dx-secondary" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}>
                  Contact Support
                </MotionButton>
              </div>
            </MotionStaggerItem>
          </MotionStagger>

          <MotionParallax className="landing-hero__visual-wrap" offset={10}>
            <MotionHeroVisual>
              <LandingHeroArt />
            </MotionHeroVisual>
            <div className="landing-hero__float-cards">
              {FLOATING_CARDS.map((card, i) => (
                <MotionFloatingCard
                  key={card.label}
                  index={i}
                  className={card.className}
                  style={{ position: 'absolute' }}
                >
                  <p className="landing-hero__float-card-label">{card.label}</p>
                  <p className="landing-hero__float-card-value">{card.value}</p>
                </MotionFloatingCard>
              ))}
            </div>
          </MotionParallax>
        </div>
      </section>

      <section className="customer-container" style={{ marginTop: -32, paddingBottom: 80 }}>
        <div className="dx-feature-cards dx-feature-cards--motion" style={{ marginBottom: 48 }}>
          {FEATURES.map(({ Icon, title, desc }, index) => (
            <MotionCard key={title} index={index} className="dx-feature-card" style={{ background: 'var(--surface)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-primary-light)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                <Icon size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{title}</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</p>
            </MotionCard>
          ))}
        </div>

        <MotionSection>
          <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 24, padding: '60px 24px', border: '1px solid var(--blue-200)' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>Ready to manage your logistics?</h2>
            <p style={{ color: 'var(--muted)', fontSize: '1.0625rem', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Sign in once with your Deliverex account — admin, dispatcher, manager, or customer.
            </p>
            <MotionButton as={Link} to="/login" className="btn-dx-primary btn-lg">
              Sign in <ArrowRight size={16} />
            </MotionButton>
          </div>
        </MotionSection>
      </section>

      <MotionSection>
        <PublicFaqSection
          variant="landing"
          description="Quick reference answers about Deliverex tracking and deliveries."
          singleOpen
          onOpenChat={() => setChatOpen(true)}
        />
      </MotionSection>

      <DeliverexSiteFooter />

      <MotionModal open={contactOpen} onClose={() => setContactOpen(false)} labelledBy="contact-modal-title">
        <div className="dx-modal-header">
          <h2 id="contact-modal-title">Contact Support</h2>
          <button type="button" className="dx-modal-close" onClick={() => setContactOpen(false)}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 28px 28px' }}>
          {contactSent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-success)', margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 8 }}>Message sent!</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 20 }}>Our team will follow up shortly.</p>
              <MotionButton type="button" className="btn-dx-primary" onClick={() => { setContactOpen(false); setContactSent(false) }}>Close</MotionButton>
            </div>
          ) : (
            <InquiryForm
              className="dx-inquiry-form--modal"
              onSubmit={sendInquiry}
              inquiryType="general_question"
              submitLabel="Send message"
              submittingLabel="Sending…"
              onSuccess={() => setContactSent(true)}
              onCancel={() => setContactOpen(false)}
            />
          )}
        </div>
      </MotionModal>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </MotionPage>
  )
}

export default LandingPage
