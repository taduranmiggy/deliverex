/** Shared public FAQ content — landing page, support page, and chat assistant. */

export const PUBLIC_FAQ_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'tracking', label: 'Tracking & Delivery' },
  { id: 'account', label: 'Account & Access' },
  { id: 'support', label: 'Concerns & Support' },
  { id: 'system', label: 'About Deliverex' },
]

export const PUBLIC_FAQS = [
  {
    id: 'track-delivery',
    category: 'tracking',
    q: 'How do I track my delivery?',
    a: 'Enter your Tracking ID on the home page, Track Delivery page, or paste it in the chat assistant. No account is required. You will see the current status, delivery timeline, ETA, and proof of delivery when the job is completed.',
  },
  {
    id: 'find-tracking-id',
    category: 'tracking',
    q: 'Where can I find my Tracking ID?',
    a: 'Your dispatcher or logistics team provides it when the shipment is created. Check SMS, email, or your delivery confirmation. Examples: TRK-ABC123, DLX-2026-001, or alphanumeric codes such as XKFP2NQRLA.',
  },
  {
    id: 'delivery-statuses',
    category: 'tracking',
    q: 'What do delivery statuses mean?',
    a: 'Typical flow: Pending (order received) → Dispatched (driver assigned) → En Route to Pickup → Arrived at Pickup → Enroute to Destination → Arrived → Completed. Each status shows where the driver and cargo are in the trip.',
  },
  {
    id: 'pod',
    category: 'tracking',
    q: 'Can I view proof of delivery (POD)?',
    a: 'Yes, once status is Completed. Open the tracking page to view POD documents, receiver name, delivery notes, and timestamps. Delivery receipts may also be captured via OCR for accurate records.',
  },
  {
    id: 'delivery-delay',
    category: 'tracking',
    q: 'My delivery is late — what should I do?',
    a: 'Check the tracking page for the latest status and ETA. If it is past the scheduled window, the system may flag a delay. Submit a concern with your Tracking ID, call (+63) 995-582-0222, or use the chat assistant for faster help.',
  },
  {
    id: 'customer-account',
    category: 'account',
    q: 'How do I get a customer account?',
    a: 'Accounts are created by a Deliverex administrator through email invitation, or linked automatically when a dispatcher creates a delivery using your company email. Sign in at the customer login page once your invitation is accepted.',
  },
  {
    id: 'link-delivery',
    category: 'account',
    q: 'How do I link a delivery to my account?',
    a: 'Deliveries for your company usually appear automatically after sign-in. If a shipment is missing, open Link Delivery, enter the Tracking ID, and make sure the email on the shipment matches your account email.',
  },
  {
    id: 'reset-password',
    category: 'account',
    q: 'How do I reset my password?',
    a: 'On the customer login page, choose Forgot Password and enter your registered email. If the account exists, you will receive a reset link. Admin, dispatcher, manager, and driver accounts use the same reset flow on their login pages.',
  },
  {
    id: 'company-users',
    category: 'account',
    q: 'Can multiple people access our company deliveries?',
    a: 'Yes. Company contacts can manage company users from the customer portal after sign-in. Your administrator invites users by email; each person signs in with their own credentials to view linked shipments.',
  },
  {
    id: 'submit-concern',
    category: 'support',
    q: 'How do I submit a concern or complaint?',
    a: 'Use Contact Support on this site, the Feedback & Concerns page when signed in, or tell the chat assistant to submit a concern. Types include delivery concern, complaint, follow-up, general question, and feedback. You will receive a reference number (e.g. INQ-2026-0001) and email confirmation.',
  },
  {
    id: 'contact-support',
    category: 'support',
    q: 'Who do I contact for delivery issues?',
    a: 'Email deliverexapp@gmail.com, call (+63) 995-582-0222, or submit the contact form with your Tracking ID and details. For quick status checks, use Track Delivery or the chat assistant first.',
  },
  {
    id: 'chat-assistant',
    category: 'support',
    q: 'What can the Deliverex Assistant help with?',
    a: 'The chat assistant answers questions about tracking, delivery statuses, accounts, and how Deliverex works — in English or Tagalog. It can look up Tracking IDs, explain POD and delays, and guide you through submitting a concern without filling a separate form.',
  },
  {
    id: 'what-is-deliverex',
    category: 'system',
    q: 'What is Deliverex?',
    a: 'Deliverex is a fleet dispatch and delivery management platform for construction and site logistics. It connects dispatchers, drivers, managers, and customers for job orders, GPS tracking, Best-Fit driver assignment, OCR document review, and proof of delivery.',
  },
  {
    id: 'services',
    category: 'system',
    q: 'What services does Deliverex support?',
    a: 'Material hauling (aggregates, sand, gravel), coordinated delivery with company drivers and vehicles, and site preparation logistics support — all tracked from dispatch through completion with delivery records and POD.',
  },
  {
    id: 'privacy-location',
    category: 'system',
    q: 'Is my delivery location shared publicly?',
    a: 'Customers see delivery status, timeline, and approximate location on the tracking page. Precise live GPS is used internally by dispatchers and managers for operations and is not exposed in full detail on the public tracking view.',
  },
]

/** Flat list for chat FAQ panel (most common questions). */
export const CHAT_FAQ_ITEMS = PUBLIC_FAQS.filter((item) => [
  'track-delivery',
  'find-tracking-id',
  'link-delivery',
  'customer-account',
  'delivery-statuses',
  'submit-concern',
].includes(item.id))

export function filterPublicFaqs(faqs, categoryId) {
  if (!categoryId || categoryId === 'all') return faqs
  return faqs.filter((item) => item.category === categoryId)
}

export function searchPublicFaqs(faqs, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return faqs
  return faqs.filter(
    (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
  )
}
