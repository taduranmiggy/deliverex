import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import LegalDocument from '../../components/customer/LegalDocument'
import { DATA_PRIVACY_POLICY } from '../../content/legal/dataPrivacyPolicy'
import { TERMS_AND_CONDITIONS } from '../../content/legal/termsAndConditions'

const LEGAL_CONTENT = {
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

const FULL_LEGAL_DOCUMENTS = {
  'terms-and-conditions': TERMS_AND_CONDITIONS,
  'privacy-policy': DATA_PRIVACY_POLICY,
}

function SimpleLegalSections({ sections }) {
  return (
    <div className="dx-panel legal-document legal-document--simple">
      {sections.map(([heading, body]) => (
        <section key={heading} className="legal-document__section">
          <h2 className="legal-document__section-title">{heading}</h2>
          <p className="legal-document__paragraph">{body}</p>
        </section>
      ))}
    </div>
  )
}

function CustomerLegalPage({ type }) {
  const fullDocument = FULL_LEGAL_DOCUMENTS[type]
  const simpleContent = LEGAL_CONTENT[type] || LEGAL_CONTENT['data-privacy-notice']

  if (fullDocument) {
    const description = [
      fullDocument.preamble,
      fullDocument.subtitle,
      fullDocument.effectiveDate ? `Effective Date: ${fullDocument.effectiveDate}` : null,
    ].filter(Boolean).join(' ')

    return (
      <CustomerPageShell className="customer-page-shell--legal">
        <CustomerPageHeader
          eyebrow="Legal"
          title={fullDocument.title}
          description={description}
        />
        <LegalDocument document={fullDocument} />
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell className="customer-page-shell--narrow">
      <CustomerPageHeader
        eyebrow="Legal"
        title={simpleContent.title}
        description={simpleContent.description}
      />
      <SimpleLegalSections sections={simpleContent.sections} />
    </CustomerPageShell>
  )
}

export default CustomerLegalPage
