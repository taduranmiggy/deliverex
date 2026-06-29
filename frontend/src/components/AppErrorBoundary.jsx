import { Component } from 'react'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Deliverex] App error:', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        className="dx-app-error"
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 400 }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: '0.9375rem' }}>
            The app could not load. Try refreshing — if this keeps happening, reinstall the app.
          </p>
          <button
            type="button"
            className="btn-dx-primary"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}

export default AppErrorBoundary
