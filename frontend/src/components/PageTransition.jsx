import { useLocation } from 'react-router-dom'

function PageTransition({ children, style }) {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="dx-page-enter" style={style}>
      {children}
    </div>
  )
}

export default PageTransition
