function CustomerSkeleton({ variant = 'card', count = 1, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i)

  if (variant === 'stat') {
    return (
      <div className={`pwa-skeleton-row ${className}`}>
        {items.map((i) => (
          <div key={i} className="pwa-skeleton pwa-skeleton--stat" />
        ))}
      </div>
    )
  }

  if (variant === 'delivery') {
    return (
      <div className={`pwa-skeleton-list ${className}`}>
        {items.map((i) => (
          <div key={i} className="pwa-skeleton pwa-skeleton--delivery" />
        ))}
      </div>
    )
  }

  if (variant === 'tracking') {
    return (
      <div className={`pwa-skeleton-stack ${className}`}>
        <div className="pwa-skeleton pwa-skeleton--tracking-header" />
        <div className="pwa-skeleton pwa-skeleton--tracking-bar" />
        <div className="pwa-skeleton pwa-skeleton--tracking-body" />
      </div>
    )
  }

  return (
    <div className={`pwa-skeleton-list ${className}`}>
      {items.map((i) => (
        <div key={i} className="pwa-skeleton pwa-skeleton--card" />
      ))}
    </div>
  )
}

export default CustomerSkeleton
