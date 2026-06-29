import { useMemo, useState } from 'react'
import { ChevronDown, HelpCircle, Search } from 'lucide-react'
import {
  PUBLIC_FAQ_CATEGORIES,
  PUBLIC_FAQS,
  filterPublicFaqs,
  searchPublicFaqs,
} from '../../data/publicFaqs'

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`pwa-faq-item${open ? ' pwa-faq-item--open' : ''}`}>
      <button
        type="button"
        className="pwa-faq-item__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown size={18} className="pwa-faq-item__chevron" />
      </button>
      <div className="pwa-faq-item__panel">
        <p>{answer}</p>
      </div>
    </div>
  )
}

export default function PublicFaqSection({
  title = 'Frequently Asked Questions',
  description = 'Quick answers about tracking, accounts, concerns, and how Deliverex works.',
  showSearch = true,
  showCategories = true,
  variant = 'default',
}) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const categories = useMemo(
    () => (showCategories ? PUBLIC_FAQ_CATEGORIES : [{ id: 'all', label: 'All' }]),
    [showCategories],
  )

  const visibleFaqs = useMemo(() => {
    const byCategory = filterPublicFaqs(PUBLIC_FAQS, category)
    return searchPublicFaqs(byCategory, search)
  }, [category, search])

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
            <FaqItem key={item.id} question={item.q} answer={item.a} />
          ))
        )}
      </div>
    </section>
  )
}
