import { Link } from 'react-router-dom'

function ChatFab() {
  return (
    <Link to="/customer" className="dx-chat-fab" title="Customer assistant & tracking">
      <span className="dx-chat-fab__inner" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
      </span>
    </Link>
  )
}

export default ChatFab
