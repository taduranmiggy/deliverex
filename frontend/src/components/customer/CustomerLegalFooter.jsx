import { Link } from 'react-router-dom'

const LEGAL_LINKS = [
  { to: '/customer/privacy-policy', label: 'Privacy Policy' },
  { to: '/customer/terms-and-conditions', label: 'Terms and Conditions' },
  { to: '/customer/data-privacy-notice', label: 'Data Privacy Notice' },
]

function CustomerLegalFooter({ variant = 'light', compact = false }) {
  const dark = variant === 'dark'
  const linkStyle = {
    color: dark ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
    textDecoration: 'none',
  }

  if (compact) {
    return (
      <div className="customer-legal-footer customer-legal-footer--compact">
        <p style={{ color: dark ? 'rgba(255,255,255,0.75)' : 'var(--text)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
          Legal
        </p>
        {LEGAL_LINKS.map((link) => (
          <p key={link.to} style={{ margin: '6px 0' }}>
            <Link to={link.to} style={linkStyle}>{link.label}</Link>
          </p>
        ))}
      </div>
    )
  }

  return (
    <footer className={`customer-legal-footer customer-legal-footer--${variant}`}>
      <div className="customer-container customer-legal-footer__inner">
        <span>Deliverex Logistics</span>
        <nav aria-label="Legal links">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>{link.label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default CustomerLegalFooter
