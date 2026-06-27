import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'

const LEGAL_CONTENT = {
  'privacy-policy': {
    title: 'Privacy Policy',
    description: 'How Deliverex handles account, delivery, contact, and proof-of-delivery information.',
    sections: [
      ['Information we collect', 'Deliverex stores company account details, delivery records, tracking identifiers, support inquiries, and proof-of-delivery documents needed to operate the logistics workflow.'],
      ['How it is used', 'Information is used for dispatch coordination, delivery status updates, customer support, account administration, audit review, and proof-of-delivery validation.'],
      ['Access and controls', 'Role-based access limits information to authorized administrators, dispatchers, managers, drivers, and linked company users.'],
    ],
  },
  'terms-and-conditions': {
    title: 'Terms and Conditions',
    description: 'Operational terms for using Deliverex delivery tracking and customer account services.',
    sections: [
      ['Authorized use', 'Deliverex is intended for company delivery tracking, dispatch coordination, support requests, and account workflows approved by the service provider.'],
      ['Tracking information', 'Status and ETA information are operational estimates based on dispatch and delivery updates. Proof-of-delivery records are shown when available.'],
      ['Account responsibility', 'Company users are responsible for keeping account access secure and reporting unauthorized access or incorrect delivery records.'],
    ],
  },
  'data-privacy-notice': {
    title: 'Data Privacy Notice',
    description: 'A customer-facing notice about logistics data handling and retention.',
    sections: [
      ['Purpose', 'Deliverex processes logistics data to create job orders, assign deliveries, update shipment status, validate proof-of-delivery, and support customer inquiries.'],
      ['Data sharing', 'Delivery information is shared only with users and teams involved in the corresponding company, job order, dispatch assignment, or support case.'],
      ['Requests', 'For data access, correction, or account support requests, contact Deliverex support through the customer support page.'],
    ],
  },
}

function CustomerLegalPage({ type }) {
  const content = LEGAL_CONTENT[type] || LEGAL_CONTENT['privacy-policy']

  return (
    <CustomerPageShell className="customer-page-shell--narrow">
      <CustomerPageHeader
        eyebrow="Legal"
        title={content.title}
        description={content.description}
      />
      <div className="dx-panel" style={{ display: 'grid', gap: 18 }}>
        {content.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 6px' }}>{heading}</h2>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.65 }}>{body}</p>
          </section>
        ))}
      </div>
    </CustomerPageShell>
  )
}

export default CustomerLegalPage
