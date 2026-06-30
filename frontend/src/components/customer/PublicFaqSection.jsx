import { useState } from 'react'
import { ChevronDown, HelpCircle, MessageSquare } from 'lucide-react'
import { PUBLIC_FAQS } from '../../data/publicFaqs'

function FaqItem({ id, question, answer, open, onToggle }) {
  return (
    <div className={`pwa-faq-item${open ? ' pwa-faq-item--open' : ''}`}>
      <button
        type="button"
        className="pwa-faq-item__trigger"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown size={18} className="pwa-faq-item__chevron" aria-hidden />
      </button>
      <div className="pwa-faq-item__panel" aria-hidden={!open}>
        <div className="pwa-faq-item__panel-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  )
}

export default function PublicFaqSection({
  title = 'Frequently Asked Questions',
  description = 'Quick answers about tracking, deliveries, and how Deliverex works.',
  items,
  singleOpen = true,
  variant = 'default',
  onOpenChat = null,
  footer = null,
}) {
  const [openId, setOpenId] = useState(null)
  const sourceFaqs = items ?? PUBLIC_FAQS

  const handleToggle = (id) => {
    if (!singleOpen) return
    setOpenId((prev) => (prev === id ? null : id))
  }

  const chatFooter = onOpenChat ? (
    <>
      <p className="dx-public-faq__chat-text">Can&apos;t find what you&apos;re looking for?</p>
      <button
        type="button"
        className="btn-dx-primary btn-sm dx-public-faq__chat-btn"
        onClick={onOpenChat}
      >
        <MessageSquare size={16} aria-hidden />
        Chat with Deliverex Assistant
      </button>
    </>
  ) : null

  const resolvedFooter = footer ?? chatFooter

  return (
    <section className={`dx-public-faq dx-public-faq--${variant}`} aria-labelledby="public-faq-heading">
      <div className="dx-public-faq__header">
        <h2 id="public-faq-heading" className="dx-public-faq__title">
          <HelpCircle size={22} aria-hidden />
          {title}
        </h2>
        {description ? <p className="dx-public-faq__desc">{description}</p> : null}
      </div>

      <div className="pwa-faq-list">
        {sourceFaqs.map((item) => (
          <FaqItem
            key={item.id}
            id={item.id}
            question={item.q}
            answer={item.a}
            open={singleOpen ? openId === item.id : false}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {resolvedFooter ? <div className="dx-public-faq__footer">{resolvedFooter}</div> : null}
    </section>
  )
}
