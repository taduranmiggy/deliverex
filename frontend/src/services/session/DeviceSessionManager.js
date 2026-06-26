import { isStandalonePwa } from '../../utils/pwaUtils'

const DEVICE_ID_KEY = 'deliverex_device_id'

/**
 * FR 1.19 — stable device identifier for driver single-session enforcement.
 */
export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = `dx_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceLabel() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad/i.test(ua)) return 'iOS Device'
  if (/Android/i.test(ua)) return 'Android Device'
  if (/Windows/i.test(ua)) return 'Windows Browser'
  if (/Mac/i.test(ua)) return 'Mac Browser'
  return 'Web Browser'
}

/** web | pwa | mobile — sent to login/refresh for cookie vs body refresh policy. */
export function detectPlatform() {
  if (isStandalonePwa()) return 'pwa'
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'mobile'
  return 'web'
}

export function buildSessionMeta() {
  return {
    device_id: getOrCreateDeviceId(),
    device_label: getDeviceLabel(),
    platform: detectPlatform(),
  }
}
