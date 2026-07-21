# Real-Time GPS over WebSockets

Driver GPS pings are broadcast the instant they are saved — no polling required for the marker.

## Flow

```
Driver app ──POST /api/driver/tracking──▶ TrackingService::record()
                                            ├─ save tracking_logs + driver_current_locations
                                            └─ broadcast DriverLocationUpdated  (ShouldBroadcastNow)
                                                 ├─ private-fleet.live          (staff)
                                                 ├─ private-trip.{assignmentId} (staff/driver)
                                                 └─ tracking.{TRACKING_CODE}    (public customer page)
```

## Production on Hostinger (required: Pusher)

Hostinger **shared hosting cannot run** `php artisan reverb:start`. Use hosted Pusher.

### 1. Create a Pusher app

1. Sign up at https://dashboard.pusher.com
2. Create an app (cluster **ap1** is fine for PH/SG)
3. Copy **App ID**, **Key**, **Secret**, **Cluster**

### 2. Hostinger secrets (SSH once)

Edit `~/domains/deliverexapp.com/shared/.deploy.secrets` and add:

```bash
BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=xxxxxx
PUSHER_APP_KEY=xxxxxx
PUSHER_APP_SECRET=xxxxxx
PUSHER_APP_CLUSTER=ap1

# Store every ~15s mobile ping (no duplicate skip)
GPS_DUPLICATE_WINDOW_SECONDS=0
GPS_MIN_MOVEMENT_METERS=0
GPS_HEARTBEAT_SECONDS=0
```

Then sync into Laravel env:

```bash
cd ~/domains/deliverexapp.com/public_html
bash scripts/provision-env.sh
php artisan config:clear
php artisan config:cache
```

### 3. GitHub Actions secrets (frontend build)

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|--------|
| `VITE_PUSHER_APP_KEY` | same as `PUSHER_APP_KEY` |
| `VITE_PUSHER_APP_CLUSTER` | `ap1` (or your cluster) |

### 4. Redeploy

Push to `main` (or re-run the Deploy workflow). After deploy:

- Customer tracking status should update **instantly** on `tracking.{CODE}`
- Dispatcher/Manager fleet map uses `private-fleet.live`
- If keys are missing, panels fall back to HTTP poll (~5s)

---

## Local development (Reverb)

Backend `.env`:

```
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=deliverex
REVERB_APP_KEY=deliverex-local
REVERB_APP_SECRET=deliverex-secret-local
REVERB_HOST=localhost
REVERB_PORT=6001
REVERB_SCHEME=http
GPS_DUPLICATE_WINDOW_SECONDS=0
GPS_MIN_MOVEMENT_METERS=0
```

Frontend `.env`:

```
VITE_REVERB_APP_KEY=deliverex-local
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=6001
VITE_REVERB_SCHEME=http
```

Three terminals:

```powershell
php artisan serve
php artisan reverb:start --debug --host=127.0.0.1 --port=6001
npx vite --host 127.0.0.1 --port 5173
```

---

## Fallback

If neither `VITE_PUSHER_APP_KEY` nor `VITE_REVERB_APP_KEY` is set at build time, the panel keeps HTTP polling (~5s). With `BROADCAST_CONNECTION=log`, the backend only logs broadcasts — **WebSockets will look “broken” even if the frontend has keys**.

## GPS ingest filters

Defaults store every driver ping (`GPS_DUPLICATE_WINDOW_SECONDS=0`, `GPS_MIN_MOVEMENT_METERS=0`). Raise these only if DB write volume becomes a problem.

`force=true` still bypasses movement filters when they are enabled.

## Event / channels

- Event name: `driver.location.updated`
- Channels: `private-fleet.live`, `private-trip.{assignmentId}`, `tracking.{TRACKING_CODE}` (public)
- Auth (private only): `POST /api/broadcasting/auth` (JWT bearer via `auth.api`)
