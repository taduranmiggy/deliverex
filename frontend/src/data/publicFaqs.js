/** Shared public FAQ content — landing page, support page, and chat assistant. */

export const PUBLIC_FAQS = [
  {
    id: 'what-is-deliverex',
    q: 'What is Deliverex?',
    a: 'Deliverex is a fleet dispatch and delivery management platform for construction and site logistics. It connects dispatchers, drivers, managers, and customers for job orders, GPS tracking, Best-Fit driver assignment, OCR document review, and proof of delivery.',
  },
  {
    id: 'services',
    q: 'What services does Deliverex support?',
    a: 'Material hauling (aggregates, sand, gravel), coordinated delivery with company drivers and vehicles, and site preparation logistics support — all tracked from dispatch through completion with delivery records and POD.',
  },
  {
    id: 'track-delivery',
    q: 'How do I track my delivery?',
    a: 'Enter your Tracking ID on the home page, Track Delivery page, or paste it in the chat assistant. No account is required. You will see the current status, delivery timeline, ETA, and proof of delivery when the job is completed.',
  },
  {
    id: 'find-tracking-id',
    q: 'Where can I find my Tracking ID?',
    a: 'Your dispatcher or logistics team provides it when the shipment is created. Check SMS, email, or your delivery confirmation. Examples: TRK-ABC123, DLX-2026-001, or alphanumeric codes such as XKFP2NQRLA.',
  },
  {
    id: 'contact-support',
    q: 'Who do I contact for delivery issues?',
    a: 'Email deliverexapp@gmail.com, call (+63) 995-582-0222, or submit the contact form with your Tracking ID and details. For quick status checks, use Track Delivery or the chat assistant first.',
  },
  {
    id: 'privacy-location',
    q: 'Is my delivery location shared publicly?',
    a: 'Customers see delivery status, timeline, and approximate location on the tracking page. Precise live GPS is used internally by dispatchers and managers for operations and is not exposed in full detail on the public tracking view.',
  },
]

/** Flat list for chat FAQ panel — same six quick-reference questions. */
export const CHAT_FAQ_ITEMS = PUBLIC_FAQS
