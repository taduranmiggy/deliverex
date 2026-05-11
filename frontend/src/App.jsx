import './App.css'
import './deliverex-ui.css'
import { AuthProvider } from './context/AuthContext'
import AppRouter from './routes/AppRouter'

function App() {
  return (
    <>
      <a href="#main-content" className="skip-to-main-link">
        Skip to main content
      </a>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </>
  )
}

export default App
