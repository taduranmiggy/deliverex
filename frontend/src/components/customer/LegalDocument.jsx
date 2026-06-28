function renderBlocks(blocks) {
  if (!blocks?.length) return null

  return blocks.map((block, index) => {
    if (block.type === 'list') {
      return (
        <ul key={`list-${index}`} className="legal-document__list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    }

    return (
      <p key={`p-${index}`} className="legal-document__paragraph">
        {block.text}
      </p>
    )
  })
}

function ContactBlock({ contact, extra }) {
  if (!contact) return null

  return (
    <div className="legal-document__contact">
      <dl className="legal-document__contact-list">
        <div><dt>Organization</dt><dd>{contact.organization}</dd></div>
        <div><dt>System</dt><dd>{contact.system}</dd></div>
        <div><dt>Contact</dt><dd>{contact.contact}</dd></div>
        <div><dt>Email</dt><dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>
        <div><dt>Address</dt><dd>{contact.address}</dd></div>
      </dl>

      {extra ? (
        <div className="legal-document__contact-extra">
          <p>{extra.intro}</p>
          <p className="legal-document__contact-extra-title">{extra.title}</p>
          <dl className="legal-document__contact-list">
            {extra.items.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function LegalDocument({ document }) {
  const lastSection = document.sections[document.sections.length - 1]
  const showContactInLastSection = lastSection?.title?.toLowerCase().includes('contact')

  return (
    <article className="legal-document dx-panel">
      {document.sections.map((section) => (
        <section key={section.number} className="legal-document__section">
          <h2 className="legal-document__section-title">
            {section.number}. {section.title}
          </h2>

          {renderBlocks(section.blocks)}

          {section.subsections?.map((subsection) => (
            <div key={subsection.number} className="legal-document__subsection">
              <h3 className="legal-document__subsection-title">
                {subsection.number} {subsection.title}
              </h3>
              {renderBlocks(subsection.blocks)}
            </div>
          ))}

          {showContactInLastSection && section.number === lastSection.number ? (
            <ContactBlock contact={document.contact} extra={document.contactExtra} />
          ) : null}
        </section>
      ))}

      <footer className="legal-document__footer">
        {document.closing ? <p>{document.closing}</p> : null}
        {document.copyright ? <p className="legal-document__copyright">{document.copyright}</p> : null}
      </footer>
    </article>
  )
}

export default LegalDocument
