/**
 * Shared page container for all customer-facing routes.
 * Keeps width, padding, and vertical rhythm consistent across website + PWA.
 */
export function CustomerPageShell({ children, className = '', bleed = false }) {
  if (bleed) {
    return (
      <div className={`customer-page-shell customer-page-shell--bleed ${className}`.trim()}>
        {children}
      </div>
    )
  }

  return (
    <div className={`customer-page-shell ${className}`.trim()}>
      <div className="customer-container">{children}</div>
    </div>
  )
}

export function CustomerPageHeader({ eyebrow, title, description, aside, className = '' }) {
  return (
    <header className={`customer-page-header ${className}`.trim()}>
      <div className="customer-page-header__main">
        {eyebrow ? <p className="customer-page-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="customer-page-description">{description}</p> : null}
      </div>
      {aside ? <div className="customer-page-header__aside">{aside}</div> : null}
    </header>
  )
}

export default CustomerPageShell
