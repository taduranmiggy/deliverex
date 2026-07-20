import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { CheckCircle2, Loader2, MapPin, Search } from 'lucide-react'
import { confirmPreciseLocation, searchPreciseLocations } from '../api/geocoding'

const PHILIPPINES_CENTER = [12.8797, 121.774]

const pinIcon = L.divIcon({
  className: 'dx-map-icon-wrap',
  html: '<div class="dx-precise-location__pin">●</div>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
})

function MapFocus({ pin }) {
  const map = useMap()
  useEffect(() => {
    if (pin) map.setView([pin.lat, pin.lng], 17)
  }, [map, pin])
  return null
}

function MapClick({ onMove }) {
  useMapEvents({
    click(event) {
      onMove({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function samePoint(a, b) {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001
}

export default function PreciseLocationPicker({
  value,
  onChange,
  idPrefix,
  context,
  error = '',
  required = true,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [traceId, setTraceId] = useState(value.geocoding_trace_id || '')
  const [provider, setProvider] = useState(value.coordinate_provider || '')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showMap, setShowMap] = useState(Boolean(value.latitude && value.longitude))
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState(
    value.latitude != null && value.longitude != null
      ? { lat: Number(value.latitude), lng: Number(value.longitude) }
      : null,
  )
  const searchSequence = useRef(0)
  const selectedQuery = useRef('')

  const adminReady = Boolean(value.region_code && value.city_code && value.barangay_code)
  const query = String(value.street || '').trim()
  const confirmed = Boolean(value.coordinate_confirmation_token)

  useEffect(() => {
    if (!adminReady || query.length < 3 || selectedQuery.current === query) return undefined
    const sequence = ++searchSequence.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setSearchError('')
      try {
        const response = await searchPreciseLocations({
          query,
          context,
          region_code: value.region_code,
          province_code: value.province_code,
          city_code: value.city_code,
          barangay_code: value.barangay_code,
          region: value.region,
          province: value.province,
          city: value.city,
          barangay: value.barangay,
        })
        if (sequence !== searchSequence.current) return
        const data = response?.data ?? response
        setSuggestions(Array.isArray(data?.candidates) ? data.candidates : [])
        setTraceId(data?.trace_id || '')
        setProvider(data?.provider || '')
      } catch (err) {
        if (sequence === searchSequence.current) {
          setSuggestions([])
          if (err.status === 404) {
            setSearchError(
              'Location search is not available on this server yet. The latest backend deploy may still be pending — refresh in a few minutes or ask an admin to confirm deploy finished (ping.php should show geocoding=yes).',
            )
          } else {
            setSearchError(err.message || 'Address suggestions are temporarily unavailable.')
          }
        }
      } finally {
        if (sequence === searchSequence.current) setLoading(false)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [adminReady, context, query, value.barangay, value.barangay_code, value.city, value.city_code, value.province, value.province_code, value.region, value.region_code])

  const clearConfirmation = (changes = {}) => onChange({
    ...value,
    latitude: null,
    longitude: null,
    geocoding_trace_id: '',
    coordinate_confirmation_token: '',
    coordinate_source: '',
    coordinate_provider: '',
    coordinate_place_id: '',
    coordinate_label: '',
    coordinate_confirmed_at: '',
    ...changes,
  })

  const selectSuggestion = (candidate) => {
    const nextPin = { lat: Number(candidate.lat), lng: Number(candidate.lng) }
    selectedQuery.current = String(candidate.name || query).trim()
    setSelected(candidate)
    setPin(nextPin)
    setShowMap(true)
    setSuggestions([])
    onChange({
      ...value,
      street: selectedQuery.current,
      latitude: nextPin.lat,
      longitude: nextPin.lng,
      geocoding_trace_id: traceId,
      coordinate_confirmation_token: '',
      coordinate_source: 'autocomplete_selection',
      coordinate_provider: candidate.provider || provider,
      coordinate_place_id: candidate.place_id || '',
      coordinate_label: candidate.label || candidate.name || '',
      coordinate_confirmed_at: '',
    })
  }

  const movePin = (nextPin) => {
    setPin(nextPin)
    setSelected(null)
    onChange({
      ...value,
      latitude: nextPin.lat,
      longitude: nextPin.lng,
      geocoding_trace_id: traceId,
      coordinate_confirmation_token: '',
      coordinate_source: 'manual_pin',
      coordinate_provider: provider,
      coordinate_place_id: '',
      coordinate_label: query,
      coordinate_confirmed_at: '',
    })
  }

  const startManualPin = () => {
    const seed = pin || (suggestions[0]
      ? { lat: Number(suggestions[0].lat), lng: Number(suggestions[0].lng) }
      : { lat: PHILIPPINES_CENTER[0], lng: PHILIPPINES_CENTER[1] })
    setPin(seed)
    setSelected(null)
    setShowMap(true)
    movePin(seed)
  }

  const confirmPin = async () => {
    if (!traceId || !pin) return
    setConfirming(true)
    setSearchError('')
    try {
      const mode = selected && samePoint(pin, { lat: Number(selected.lat), lng: Number(selected.lng) })
        ? 'autocomplete'
        : 'manual_pin'
      const response = await confirmPreciseLocation(traceId, {
        mode,
        candidate_id: mode === 'autocomplete' ? selected.id : null,
        latitude: pin.lat,
        longitude: pin.lng,
      })
      const data = response?.data ?? response
      onChange({
        ...value,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        geocoding_trace_id: data.trace_id,
        coordinate_confirmation_token: data.confirmation_token,
        coordinate_source: data.source,
        coordinate_provider: selected?.provider || provider,
        coordinate_place_id: selected?.place_id || '',
        coordinate_label: selected?.label || query,
        coordinate_confirmed_at: new Date().toISOString(),
      })
    } catch (err) {
      setSearchError(err.message || 'Could not confirm this map location.')
    } finally {
      setConfirming(false)
    }
  }

  const center = useMemo(() => pin ? [pin.lat, pin.lng] : PHILIPPINES_CENTER, [pin])

  return (
    <div className="dx-precise-location">
      <label className="dx-psgc-address__field dx-psgc-address__field--full">
        <span className="dx-wiz-label-text">Place / Street / Building / House No.{required ? ' *' : ''}</span>
        <div className="dx-precise-location__search-wrap">
          <Search size={16} aria-hidden />
          <input
            id={`${idPrefix}-street`}
            className={`dx-wiz-input dx-psgc-address__input${error ? ' dx-wiz-input--error' : ''}`}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            value={value.street || ''}
            disabled={!adminReady}
            autoComplete="off"
            onChange={(event) => {
              selectedQuery.current = ''
              setSelected(null)
              setPin(null)
              setShowMap(false)
              clearConfirmation({ street: event.target.value })
            }}
            placeholder={adminReady ? 'Search a place, school, building, or street (e.g. FEU)' : 'Select the barangay first'}
          />
          {loading && <Loader2 size={17} className="dx-precise-location__spinner" aria-label="Searching" />}
        </div>
        {error && <span className="dx-psgc-address__field-error" role="alert">{error}</span>}
      </label>

      {suggestions.length > 0 && (
        <div className="dx-precise-location__suggestions" role="listbox" aria-label="Address suggestions">
          {suggestions.map((candidate) => (
            <button key={candidate.id} type="button" role="option" onClick={() => selectSuggestion(candidate)}>
              <MapPin size={16} aria-hidden />
              <span><strong>{candidate.name || candidate.label}</strong><small>{candidate.label}</small></span>
              <em>{candidate.type}</em>
            </button>
          ))}
        </div>
      )}

      {adminReady && query.length >= 3 && traceId && !showMap && !loading && (
        <button type="button" className="btn-dx-secondary btn-sm dx-precise-location__manual" onClick={startManualPin}>
          No exact result? Place the pin manually
        </button>
      )}

      {showMap && pin && (
        <div className="dx-precise-location__map-card">
          <div className="dx-precise-location__map-copy">
            <strong>Confirm the exact entrance or loading point</strong>
            <span>Drag the marker or click the map. Routing will always reuse this saved point.</span>
          </div>
          <div className="dx-precise-location__map">
            <MapContainer center={center} zoom={17} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFocus pin={pin} />
              <MapClick onMove={movePin} />
              <Marker
                position={[pin.lat, pin.lng]}
                draggable
                icon={pinIcon}
                eventHandlers={{
                  dragend(event) {
                    const point = event.target.getLatLng()
                    movePin({ lat: point.lat, lng: point.lng })
                  },
                }}
              />
            </MapContainer>
          </div>
          <div className="dx-precise-location__confirm-row">
            <code>{pin.lat.toFixed(7)}, {pin.lng.toFixed(7)}</code>
            {confirmed ? (
              <span className="dx-precise-location__confirmed"><CheckCircle2 size={16} /> Exact pin confirmed</span>
            ) : (
              <button type="button" className="btn-dx-primary btn-sm" disabled={confirming || !traceId} onClick={confirmPin}>
                {confirming ? 'Confirming…' : 'Confirm this pin'}
              </button>
            )}
          </div>
        </div>
      )}

      {searchError && <p className="dx-psgc-address__error" role="alert">{searchError}</p>}
    </div>
  )
}
