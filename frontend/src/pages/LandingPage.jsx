import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import DeliverexAssistantChat from '../components/DeliverexAssistantChat'
import { IconDoc, IconClock, IconRoute } from '../components/DxIcons'
import './LandingPage.css'
import trucksBg from '../assets/trucks-bg.jpg'

export default function LandingPage() {
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Deliverex — Track & verify deliveries'
    return () => {
      document.title = 'Deliverex'
    }
  }, [])

  const scrollTo = (hash) => {
    const id = hash.replace('#', '')
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openAssistant = () => setAssistantOpen(true)

  const goContact = () => {
    scrollTo('landing-contact')
    setAssistantOpen(false)
  }

  const handleTrackSubmit = (event) => {
    event.preventDefault()
    const trimmed = trackingCode.trim()
    if (!trimmed) return
    navigate('/track', { state: { prefillTracking: trimmed } })
  }

  return (
    <>
      <div className="landing-hero-shell" style={{ backgroundImage: `url(${trucksBg})` }}>
        <header className="landing-header">
          <Link to="/" className="landing-brand-link">
            <div className="brand">Deliverex</div>
          </Link>
          <nav>
            <button
              type="button"
              className="nav-link ghost"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Home
            </button>
            <button type="button" className="nav-link ghost" onClick={() => scrollTo('landing-contact')}>
              Contact
            </button>
            <Link to="/login" className="nav-link landing-header-login">
              Login
            </Link>
            <Link to="/customer/signup" className="nav-link landing-header-signup">
              Create account
            </Link>
          </nav>
        </header>
        <div className="landing-hero-centered">
          <h1>Track and verify your deliveries with confidence.</h1>
          <p>Deliverex provides live status, ETA windows, and proof-of-delivery confirmation.</p>
          <form className="landing-track" onSubmit={handleTrackSubmit} aria-label="Track delivery">
            <label className="landing-track-label" htmlFor="landing-track-id">
              Enter Job Order ID
            </label>
            <div className="landing-track-row">
              <input
                id="landing-track-id"
                type="text"
                name="trackingCode"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
                placeholder="e.g. JO-2026-00421"
                autoComplete="off"
              />
              <button type="submit">Track now</button>
            </div>
            <p className="landing-track-hint">No account needed. Just your Job Order ID.</p>
            <button
              type="button"
              className="landing-track-help"
              onClick={() => scrollTo('landing-contact')}
            >
              Need help finding your Job Order ID?
            </button>
          </form>
          <div className="landing-hero-actions">
            <button type="button" className="primary" onClick={openAssistant}>
              Open Chat to Track
            </button>
            <button type="button" className="secondary" onClick={goContact}>
              Contact Support
            </button>
          </div>
        </div>
      </div>

      <main className="landing-main">
        <section id="landing-features" className="landing-features">
          <div className="landing-inner">
            <div className="landing-feature-cards">
              <article className="landing-feature-card">
                <div className="landing-feature-icon" aria-hidden>
                  <IconRoute />
                </div>
                <h3>Real-Time Status</h3>
                <p>Live updates from dispatch to delivery completion.</p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-feature-icon landing-feature-clock" aria-hidden>
                  <IconClock />
                </div>
                <h3>ETA Windows</h3>
                <p>Accurate arrival time estimates for better planning.</p>
              </article>
              <article className="landing-feature-card">
                <div className="landing-feature-icon" aria-hidden>
                  <IconDoc />
                </div>
                <h3>Proof of Delivery</h3>
                <p>Digital confirmation and documentation for every delivery.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-how-wrap">
          <div className="landing-inner">
            <h2 className="landing-how-title">How It Works</h2>
            <ol className="landing-how-steps">
              <li>
                <span className="landing-step-num">1</span>
                <div>
                  <strong>Get your Tracking ID from your provider.</strong>
                  <p>
                    Your tracking ID is provided by the delivery coordinator or appears on your
                    delivery documentation.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">2</span>
                <div>
                  <strong>Open the Chat and enter your ID.</strong>
                  <p>
                    Click the chat button and follow the prompts to enter your tracking ID for
                    instant lookup.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">3</span>
                <div>
                  <strong>View status / ETA / PoD and optional details.</strong>
                  <p>
                    Get real-time status updates, estimated arrival windows, and proof-of-delivery
                    information.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="landing-track-section" aria-label="Track a delivery">
          <div className="landing-inner">
            <div className="landing-track-panel">
              <div>
                <h2>Track a delivery in seconds</h2>
                <p>Enter your Job Order ID to see live status, ETA, and proof-of-delivery updates.</p>
              </div>
              <form className="landing-track" onSubmit={handleTrackSubmit}>
                <label className="landing-track-label" htmlFor="landing-track-id-inline">
                  Job Order ID
                </label>
                <div className="landing-track-row">
                  <input
                    id="landing-track-id-inline"
                    type="text"
                    name="trackingCode"
                    value={trackingCode}
                    onChange={(event) => setTrackingCode(event.target.value)}
                    placeholder="e.g. JO-2026-00421"
                    autoComplete="off"
                  />
                  <button type="submit">Track now</button>
                </div>
                <p className="landing-track-hint">No account needed. Just your Job Order ID.</p>
                <button
                  type="button"
                  className="landing-track-help"
                  onClick={() => scrollTo('landing-contact')}
                >
                  Need help finding your Job Order ID?
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <DeliverexAssistantChat open={assistantOpen} onOpenChange={setAssistantOpen} />

      <footer id="landing-contact" className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <h4 className="landing-footer-heading">Contact</h4>
            <p>
              <a href="mailto:support@deliverex.ph">support@deliverex.ph</a>
            </p>
            <p>
              <a href="tel:+639171234567">(+63) 917-123-4567</a>
            </p>
          </div>
          <div>
            <h4 className="landing-footer-heading">Legal</h4>
            <p>
              <button type="button" className="landing-footer-btn" onClick={() => alert('Privacy policy placeholder')}>
                Privacy Policy
              </button>
            </p>
            <p>
              <button type="button" className="landing-footer-btn" onClick={() => alert('Terms of service placeholder')}>
                Terms of Service
              </button>
            </p>
          </div>
          <div>
            <h4 className="landing-footer-heading">About</h4>
            <p className="landing-footer-about">
              Deliverex Logistics – Providential B2B Site Preparation Services.
            </p>
          </div>
        </div>
        <div className="landing-footer-rule" />
        <p className="landing-footer-copy">© 2026 Deliverex. All rights reserved.</p>
      </footer>
    </>
  )
}
