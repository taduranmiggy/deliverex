import './App.css'
import './deliverex-ui.css'
import './styles/staff-sidebar.css'
import './styles/customer-pwa.css'
import './styles/responsive-system.css'
import './styles/pwa-mobile-audit.css'
import './styles/customer-layout-system.css'
import './styles/customer-website.css'
import './styles/session-status.css'
import './styles/accessibility.css'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import PwaSplashScreen from './components/customer/PwaSplashScreen'
import AppRouter from './routes/AppRouter'

function App() {
  return (
    <>
      <a href="#main-content" className="skip-to-main-link">
        Skip to main content
      </a>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
      <PwaSplashScreen />
    </>
  )
}

export default App
