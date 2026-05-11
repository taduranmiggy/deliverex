import { NavLink, Link, Outlet } from 'react-router-dom'

import useAuth from '../hooks/useAuth'



function CustomerLayout() {

  const { isAuthenticated, role, logout } = useAuth()

  const isCustomer = isAuthenticated && role === 'customer'



  const handleLogout = async () => {

    await logout()

  }



  return (

    <div>

      <header className="card" style={{ margin: '24px 32px', display: 'flex', justifyContent: 'space-between' }}>

        <Link to="/customer" className="brand">

          Deliverex

        </Link>

        <nav className="inline" aria-label="Customer navigation">

          <NavLink end to="/customer">

            Home

          </NavLink>

          <NavLink to="/customer/track">Track delivery</NavLink>

          {isCustomer ? (

            <>

              <NavLink to="/customer/deliveries">My deliveries</NavLink>

              <button

                type="button"

                onClick={handleLogout}

                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.5rem' }}

              >

                Sign out

              </button>

            </>

          ) : (

            <>

              <NavLink to="/customer/signup">Create account</NavLink>

              <NavLink to="/login">Sign in</NavLink>

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

