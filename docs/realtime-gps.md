# Real-Time GPS over WebSockets (Laravel Reverb)

Driver GPS pings are broadcast the instant they are saved — no polling.

## Flow

```
Driver app ──POST /api/driver/tracking──▶ TrackingService::record()
                                            ├─ save tracking_logs + driver_current_locations
                                            └─ broadcast DriverLocationUpdated  (ShouldBroadcastNow)
                                                 ├─ private-fleet.live          (all dispatchers/managers/admins)
                                                 └─ private-trip.{assignmentId} (per-trip subscribers)

Web panel ──Echo (pusher protocol)──▶ marker animates immediately (AnimatedDriverMarker)
```

- **Event:** `driver.location.updated` — payload: `driver_id`, `trip_id`, `latitude`,
  `longitude`, `timestamp`, `heading`, `speed`, plus the pre-formatted `location`
  object used by the fleet map.
- **Channel auth:** `POST /api/broadcasting/auth` behind the `auth.api` (JWT bearer)
  middleware. Roles allowed on `fleet.live`: admin, dispatcher, manager.
- **No queue worker needed:** the event implements `ShouldBroadcastNow`.
- **Reconnect handling:** the frontend refetches one snapshot when the socket
  reconnects, and shows "Waiting for driver connection…" per driver when no GPS
  has arrived recently.

## Enabling in an environment

Backend `.env`:

```
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=deliverex
REVERB_APP_KEY=<random-string>
REVERB_APP_SECRET=<random-string>
REVERB_HOST=127.0.0.1     # where the app server reaches Reverb
REVERB_PORT=8080
REVERB_SCHEME=http
```

Run the WebSocket server (long-running process):

```
php artisan reverb:start
```

Frontend build-time vars (must match the backend key):

```
VITE_REVERB_APP_KEY=<same REVERB_APP_KEY>
VITE_REVERB_HOST=deliverexapp.com   # public hostname browsers connect to
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

In production put Reverb behind the web server as a reverse proxy for
`wss://deliverexapp.com/app/...` → `127.0.0.1:8080`.

## Fallback behavior

If `VITE_REVERB_APP_KEY` is **not** set at build time, the panel automatically
falls back to the legacy HTTP polling (dispatcher 60s / manager 30s), so
environments without a running Reverb server keep working unchanged. With
`BROADCAST_CONNECTION=log` the backend simply logs broadcasts.

> **Hostinger shared hosting cannot run `reverb:start`** (no long-running
> processes / open ports). Options: move to a VPS, run Reverb on a small
> separate host, or switch `BROADCAST_CONNECTION=pusher` with hosted Pusher
> credentials — the frontend Echo client speaks the same protocol.

## Local test

1. `php artisan reverb:start --debug`
2. Set the four `VITE_REVERB_*` vars in `frontend/.env`, restart `npm run dev`
3. Log in as dispatcher → Tracking page (status pill shows "Live — real-time")
4. POST a GPS ping as the driver — the truck marker glides to the new position
   instantly on every open dispatcher tab.
