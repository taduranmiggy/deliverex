import { useMemo, useState } from 'react'
import { ChevronDown, HelpCircle, Search } from 'lucide-react'
import {
  PUBLIC_FAQ_CATEGORIES,
  PUBLIC_FAQS,
  filterPublicFaqs,
  searchPublicFaqs,
} from '../../data/publicFaqs'

function FaqItem({ id, question, answer, open, onToggle, singleOpen }) {
  const isOpen = singleOpen ? open : undefined

  const [localOpen, setLocalOpen] = useState(false)
  const expanded = singleOpen ? isOpen : localOpen

  const handleClick = () => {
    if (singleOpen) {
      onToggle(id)
      return
    }
    setLocalOpen((v) => !v)
  }

  return (
    <div className={`pwa-faq-item${expanded ? ' pwa-faq-item--open' : ''}`}>
      <button
        type="button"
        className="pwa-faq-item__trigger"
        onClick={handleClick}
        aria-expanded={expanded}
      >
        <span>{question}</span>
        <ChevronDown size={18} className="pwa-faq-item__chevron" aria-hidden />
      </button>
      <div className="pwa-faq-item__panel">
        <div className="pwa-faq-item__panel-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  )
}

export default function PublicFaqSection({
  title = 'Frequently Asked Questions',
  description = 'Quick answers about tracking, accounts, concerns, and how Deliverex works.',
  items,
  showSearch = true,
  showCategories = true,
  singleOpen = false,
  variant = 'default',
  footer = null,
}) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)

  const sourceFaqs = items ?? PUBLIC_FAQS

  const categories = useMemo(
    () => (showCategories ? PUBLIC_FAQ_CATEGORIES : [{ id: 'all', label: 'All' }]),
    [showCategories],
  )

  const visibleFaqs = useMemo(() => {
    const byCategory = filterPublicFaqs(sourceFaqs, category)
    return searchPublicFaqs(byCategory, search)
  }, [sourceFaqs, category, search])

  const handleToggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <section className={`dx-public-faq dx-public-faq--${variant}`} aria-labelledby="public-faq-heading">
      <div className="dx-public-faq__header">
        <h2 id="public-faq-heading" className="dx-public-faq__title">
          <HelpCircle size={22} aria-hidden />
          {title}
        </h2>
        {description ? <p className="dx-public-faq__desc">{description}</p> : null}
      </div>

      {(showSearch || showCategories) ? (
        <div className="dx-public-faq__toolbar">
          {showCategories ? (
            <div className="dx-public-faq__chips" role="tablist" aria-label="FAQ categories">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={category === cat.id}
                  className={`dx-public-faq__chip${category === cat.id ? ' dx-public-faq__chip--active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ) : null}

          {showSearch ? (
            <label className="dx-public-faq__search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                aria-label="Search FAQs"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="pwa-faq-list">
        {visibleFaqs.length === 0 ? (
          <p className="dx-public-faq__empty">No questions match your search. Try another keyword or contact support.</p>
        ) : (
          visibleFaqs.map((item) => (
            <FaqItem
              key={item.id}
              id={item.id}
              question={item.q}
              answer={item.a}
              singleOpen={singleOpen}
              open={openId === item.id}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>

      {footer ? <div className="dx-public-faq__footer">{footer}</div> : null}
    </section>
  )
}
