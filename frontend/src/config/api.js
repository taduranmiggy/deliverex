/** Same-origin /api in production when VITE_API_URL is not set at build time. */
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api')
