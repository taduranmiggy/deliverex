# Real-Time GPS over WebSockets

Driver GPS pings are broadcast the instant they are saved — no polling.

## Flow

```
Driver app ──POST /api/driver/tracking──▶ TrackingService::record()
                                            ├─ save tracking_logs + driver_current_locations
                                            └─ broadcast DriverLocationUpdated  (ShouldBroadcastNow)
                                                 ├─ private-fleet.live
                                                 └─ private-trip.{assignmentId}

Web panel ──Echo (Pusher protocol)──▶ marker animates immediately
```

## Production on Hostinger (recommended: Pusher)

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

Push to `main` (or re-run the Deploy workflow). After deploy, open Tracking — status should say **Live — real-time**.

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

If neither `VITE_PUSHER_APP_KEY` nor `VITE_REVERB_APP_KEY` is set at build time, the panel keeps HTTP polling. With `BROADCAST_CONNECTION=log`, the backend only logs broadcasts.

## Event / channels

- Event name: `driver.location.updated`
- Channels: `private-fleet.live`, `private-trip.{assignmentId}`
- Auth: `POST /api/broadcasting/auth` (JWT bearer via `auth.api`)
