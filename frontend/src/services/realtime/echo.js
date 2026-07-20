import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { apiRequest } from '../../api/client'

/**
 * Singleton Laravel Echo client for real-time GPS.
 *
 * Supports:
 * - Hosted Pusher (Hostinger-friendly): set VITE_PUSHER_APP_KEY + VITE_PUSHER_APP_CLUSTER
 * - Self-hosted Laravel Reverb: set VITE_REVERB_APP_KEY (+ host/port/scheme)
 *
 * Channel auth uses apiRequest → POST /api/broadcasting/auth (JWT bearer).
 */

const PUSHER_KEY = import.meta.env.VITE_PUSHER_APP_KEY || ''
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap1'

const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY || ''
const REVERB_HOST =
  import.meta.env.VITE_REVERB_HOST ||
  (import.meta.env.PROD ? window.location.hostname : 'localhost')
const REVERB_PORT = Number(
  import.meta.env.VITE_REVERB_PORT || (import.meta.env.PROD ? 443 : 6001),
)
const REVERB_SCHEME =
  import.meta.env.VITE_REVERB_SCHEME || (import.meta.env.PROD ? 'https' : 'http')

export const CONNECTION_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  UNAVAILABLE: 'unavailable',
  DISCONNECTED: 'disconnected',
}

let echoInstance = null

export function isRealtimeConfigured() {
  return Boolean(PUSHER_KEY || REVERB_KEY)
}

export function realtimeDriver() {
  if (PUSHER_KEY) return 'pusher'
  if (REVERB_KEY) return 'reverb'
  return null
}

function authorizer(channel) {
  return {
    authorize: (socketId, callback) => {
      apiRequest('/broadcasting/auth', {
        method: 'POST',
        body: JSON.stringify({
          socket_id: socketId,
          channel_name: channel.name,
        }),
      })
        .then((response) => callback(null, response))
        .catch((error) => callback(error, null))
    },
  }
}

export function getEcho() {
  if (!isRealtimeConfigured()) return null
  if (echoInstance) return echoInstance

  window.Pusher = Pusher

  const driver = realtimeDriver()
  const base = {
    authorizer,
    activityTimeout: 30_000,
    pongTimeout: 10_000,
  }

  if (driver === 'pusher') {
    echoInstance = new Echo({
      ...base,
      broadcaster: 'pusher',
      key: PUSHER_KEY,
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
    })
  } else {
    echoInstance = new Echo({
      ...base,
      broadcaster: 'reverb',
      key: REVERB_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
    })
  }

  return echoInstance
}

/**
 * Observe the raw Pusher connection state.
 * Returns an unsubscribe function.
 */
export function onConnectionStateChange(handler) {
  const echo = getEcho()
  if (!echo) return () => {}

  const connection = echo.connector.pusher.connection
  const listener = ({ current }) => handler(current)

  connection.bind('state_change', listener)
  handler(connection.state)

  return () => connection.unbind('state_change', listener)
}

export function disconnectEcho() {
  if (echoInstance) {
    echoInstance.disconnect()
    echoInstance = null
  }
}
