import { useState } from 'react'

import { NavLink, Link, Outlet } from 'react-router-dom'

import useAuth from '../hooks/useAuth'



function CustomerLayout() {

  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const { isAuthenticated, role, logout } = useAuth()

  const isCustomer = isAuthenticated && role === 'customer'



  const handleLogout = async () => {

    setIsMenuOpen(false)

    await logout()

  }

  const handleNavToggle = () => {

    setIsMenuOpen((current) => !current)

  }

  const handleNavClick = () => {

    setIsMenuOpen(false)

  }



  return (

    <div>

      <header className="customer-shell">

        <div className="customer-shell__brand">

          <Link to="/customer" className="brand">

            Deliverex

          </Link>

          <button

            type="button"

            className="customer-nav-toggle"

            aria-expanded={isMenuOpen}

            aria-controls="customer-nav"

            onClick={handleNavToggle}

          >

            Menu

          </button>

        </div>

        <nav

          id="customer-nav"

          className={`customer-nav ${isMenuOpen ? 'customer-nav--open' : ''}`}

          aria-label="Customer navigation"

        >

          <NavLink end to="/customer" className="customer-nav-link" onClick={handleNavClick}>

            Home

          </NavLink>

          <NavLink to="/customer/track" className="customer-nav-link" onClick={handleNavClick}>

            Track delivery

          </NavLink>

          {isCustomer ? (

            <>

              <NavLink

                to="/customer/deliveries"

                className="customer-nav-link"

                onClick={handleNavClick}

              >

                My deliveries

              </NavLink>

              <button

                type="button"

                onClick={handleLogout}

                className="customer-nav-link customer-nav-link--button"

              >

                Sign out

              </button>

            </>

          ) : (

            <>

              <NavLink

                to="/customer/signup"

                className="customer-nav-link"

                onClick={handleNavClick}

              >

                Create account

              </NavLink>

              <NavLink to="/login" className="customer-nav-link" onClick={handleNavClick}>

                Sign in

              </NavLink>

            </>

          )}

        </nav>

      </header>

      <main id="main-content" tabIndex={-1} className="page">

        <Outlet />

      </main>

    </div>

  )

}



export default CustomerLayout

