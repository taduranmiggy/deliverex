/**
 * FR 1.17 — encrypted local storage for PWA refresh tokens.
 * Uses Web Crypto AES-GCM; key material is device-scoped (not password-derived).
 */
const KEY_STORAGE = 'deliverex_crypto_key_v1'
const REFRESH_KEY = 'deliverex_refresh_enc'

function supportsWebCrypto() {
  return typeof window !== 'undefined' && window.crypto?.subtle
}

async function getOrCreateKey() {
  if (!supportsWebCrypto()) return null

  const existing = localStorage.getItem(KEY_STORAGE)
  if (existing) {
    try {
      const raw = Uint8Array.from(atob(existing), (c) => c.charCodeAt(0))
      return window.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
    } catch {
      localStorage.removeItem(KEY_STORAGE)
    }
  }

  const rawKey = window.crypto.getRandomValues(new Uint8Array(32))
  localStorage.setItem(KEY_STORAGE, btoa(String.fromCharCode(...rawKey)))
  return window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptRefreshToken(plain) {
  if (!plain) return null
  const key = await getOrCreateKey()
  if (!key) {
    // Fallback when Web Crypto unavailable — still avoid plain-text key name.
    return btoa(unescape(encodeURIComponent(plain)))
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const bundle = new Uint8Array(iv.length + cipher.byteLength)
  bundle.set(iv, 0)
  bundle.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...bundle))
}

export async function decryptRefreshToken(stored) {
  if (!stored) return null
  const key = await getOrCreateKey()
  if (!key) {
    try {
      return decodeURIComponent(escape(atob(stored)))
    } catch {
      return null
    }
  }

  try {
    const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const data = bytes.slice(12)
    const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plainBuf)
  } catch {
    return null
  }
}

export async function saveEncryptedRefresh(token) {
  if (!token) {
    localStorage.removeItem(REFRESH_KEY)
    return
  }
  const enc = await encryptRefreshToken(token)
  if (enc) localStorage.setItem(REFRESH_KEY, enc)
}

export async function loadEncryptedRefresh() {
  const enc = localStorage.getItem(REFRESH_KEY)
  if (!enc) return null
  return decryptRefreshToken(enc)
}

export function clearEncryptedRefresh() {
  localStorage.removeItem(REFRESH_KEY)
}
