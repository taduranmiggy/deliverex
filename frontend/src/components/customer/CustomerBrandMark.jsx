const LOGO_1X = '/favicon-48x48.png?v=2'
const LOGO_2X = '/favicon-192x192.png?v=2'

function CustomerBrandMark({ className = '' }) {
  return (
    <div className={`customer-nav-brand-icon${className ? ` ${className}` : ''}`} aria-hidden>
      <img
        src={LOGO_1X}
        srcSet={`${LOGO_1X} 1x, ${LOGO_2X} 2x`}
        alt=""
        width={36}
        height={36}
        decoding="async"
      />
    </div>
  )
}

export default CustomerBrandMark
