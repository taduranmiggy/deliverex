function LandingPage() {
  return (
    <div className="page">
      <header className="landing-hero">
        <div className="header-stack">
          <h1>Track and verify your site deliveries with confidence.</h1>
          <p>Deliverex provides live status, ETA windows, and proof-of-delivery confirmation.</p>
          <div className="actions">
            <button className="btn primary" type="button">Open Chat to Track</button>
            <button className="btn ghost" type="button">Contact Support</button>
          </div>
        </div>
      </header>
      <section className="landing-grid">
        <article className="card">
          <strong>Real-Time Status</strong>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Live updates from dispatch to delivery completion.</p>
        </article>
        <article className="card">
          <strong>ETA Windows</strong>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Accurate arrival estimates for better planning.</p>
        </article>
        <article className="card">
          <strong>Proof of Delivery</strong>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Digital confirmation and documentation for every delivery.</p>
        </article>
      </section>
      <section className="card" style={{ marginTop: '24px' }}>
        <h3>How It Works</h3>
        <ol style={{ paddingLeft: '16px', color: 'var(--muted)' }}>
          <li>Get your Tracking ID from your provider.</li>
          <li>Open the chat and enter your ID.</li>
          <li>View status, ETA/POD, and optional details.</li>
        </ol>
      </section>
      <button className="chat-fab" type="button">?</button>
    </div>
  )
}

export default LandingPage
