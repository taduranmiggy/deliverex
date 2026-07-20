# Deliverex Address-to-Coordinate Pipeline

## Root-cause analysis

The inaccurate markers originated before Leaflet:

1. PSGC validated the administrative hierarchy, but the precise place was still a free-text street/building string.
2. The backend geocoded that string without showing candidates to the dispatcher. A scored provider result—not a user-confirmed entrance or loading point—became authoritative.
3. `ensureCoordinates()` was called by map, tracking, live-fleet, manager-fleet, and arrival reads. Opening a page could geocode, clear, or reconcile stored coordinates.
4. The system had application-log fragments but no durable record of the raw input, provider request, full response, all candidates, rejection reasons, selected result, stored pair, API pair, and rendered pair.
5. Public Nominatim is a forward-search fallback, not an autocomplete service. Its public usage policy explicitly forbids client autocomplete and is unsuitable as the primary service for a logistics application.

The following were verified and are **not** the source of the offset:

- `pickup_latitude`, `pickup_longitude`, `dropoff_latitude`, and `dropoff_longitude` are numeric `DECIMAL(10,7)` columns. Seven decimal places preserve approximately centimetre-level storage resolution.
- Eloquent returns these columns as numbers through `float` casts.
- OpenRouteService and OSRM receive GeoJSON order `[longitude, latitude]`.
- Their route geometry is converted back to Leaflet order `[latitude, longitude]`.
- Leaflet markers receive the API pair directly; no offset or address re-geocoding occurs in the browser.

## New source-of-truth workflow

```mermaid
flowchart TD
    A["PSGC region / province / city / barangay"] --> B["Debounced place search"]
    B --> C["Backend provider adapter"]
    C --> D["Persist raw request, full response, and every candidate"]
    D --> E["Remove candidates conflicting with selected PSGC city/province"]
    E --> F["Dispatcher selects suggestion"]
    E --> G["No exact result: dispatcher places draggable pin"]
    F --> H["Review exact point on Leaflet"]
    G --> H
    H --> I["Confirm pin and issue signed, field-bound token"]
    I --> J["Validate PSGC hierarchy and signed token"]
    J --> K["Store coordinates once as DECIMAL(10,7)"]
    K --> L["Tracking / Fleet / Reports reuse stored pair only"]
    L --> M["Leaflet renders the exact API pair"]
```

Changing any PSGC division or the place text invalidates the confirmation. A pickup token cannot be reused for a destination and vice versa. Provider candidates with an explicit city or province that conflicts with the selected PSGC hierarchy are logged with a rejection reason but never offered for selection.

## Provider policy

| Provider | Deliverex role | Notes |
|---|---|---|
| Geoapify | Recommended production primary | Dedicated autocomplete endpoint, country filters, place IDs, address components, and confidence/rank fields. Configure `GEOAPIFY_API_KEY`. |
| OpenRouteService / Pelias | Authenticated fallback | Supports a dedicated autocomplete endpoint, country boundaries, POIs, addresses, and streets. Uses `OPENROUTESERVICE_API_KEY`. |
| Photon | Development/self-hosted fallback | Designed for search-as-you-type and supports country/bounding-box filters. The public demo has no availability guarantee; self-host or replace it for production volume. |
| Nominatim | Legacy/non-interactive compatibility only | Never used for live autocomplete. Public Nominatim forbids autocomplete and has strict capacity limits; bulk backfills require a compliant managed or self-hosted service. |

Provider order is configurable without a software release:

```dotenv
GEOAPIFY_API_KEY=
OPENROUTESERVICE_API_KEY=
GEOCODING_AUTOCOMPLETE_PROVIDERS=geoapify,openrouteservice,photon
PHOTON_URL=https://photon.komoot.io/api/
```

For an enterprise deployment, set a Geoapify key or a managed/private Pelias or Photon endpoint. The public Photon demo should not be treated as an SLA-backed production dependency.

## Persistent diagnostics

Every autocomplete attempt creates a `geocoding_traces` record containing:

- raw user input and normalized address;
- selected provider, sanitized request URL, and request parameters (API keys are excluded);
- full provider responses and every provider attempt;
- every normalized candidate, its score, eligibility, and PSGC conflict reason;
- selected candidate and explicit user selection reason;
- selected, stored, API-returned, and Leaflet-rendered coordinates;
- user, pickup/destination context, related record, status, errors, and timestamps.

The normal application log can still emit concise pipeline stages with `GPS_DEBUG_PIPELINE=true`, while the database trace remains the durable diagnostic source.

Administrators can inspect trace summaries at `GET /api/admin/geocoding-traces` and a complete provider request/response at `GET /api/admin/geocoding-traces/{id}`. API keys are never stored in trace request parameters.

## Read-path invariant

`ensureCoordinates()` is now restricted to the explicit legacy command:

```shell
php artisan addresses:geocode-legacy --limit=500
```

Map, tracking, dispatcher, fleet, manager, report, and arrival-verification reads never call a geocoder and never modify the job order. If a legacy job has no coordinate pair, the UI reports the location as unavailable until the one-time backfill or a dispatcher edit confirms the point.

## Integrity checks

For a trace, these pairs must be identical to seven decimal places:

1. `selected_latitude` / `selected_longitude`
2. `stored_latitude` / `stored_longitude`
3. `api_latitude` / `api_longitude`
4. `rendered_latitude` / `rendered_longitude`

Any divergence now identifies the exact pipeline boundary where corruption occurred instead of requiring guesswork from a misplaced marker.
