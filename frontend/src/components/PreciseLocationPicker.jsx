import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { CheckCircle2, Loader2, MapPin, Search } from 'lucide-react'
import { confirmPreciseLocation, geocodeManualAddress, searchPreciseLocations } from '../api/geocoding'

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

function highlightMatches(text, matchedSubstrings = []) {
  if (!text || !Array.isArray(matchedSubstrings) || matchedSubstrings.length === 0) {
    return text
  }

  const parts = []
  let cursor = 0
  const ranges = [...matchedSubstrings]
    .map((match) => ({
      start: Number(match.offset ?? 0),
      end: Number(match.offset ?? 0) + Number(match.length ?? 0),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start)

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(<span key={`text-${index}-${cursor}`}>{text.slice(cursor, range.start)}</span>)
    }
    parts.push(
      <mark key={`mark-${index}-${range.start}`} className="dx-precise-location__match">
        {text.slice(range.start, range.end)}
      </mark>,
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    parts.push(<span key={`tail-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return parts
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
  const [manualGeocoding, setManualGeocoding] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showMap, setShowMap] = useState(Boolean(value.latitude && value.longitude))
  const [selected, setSelected] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pin, setPin] = useState(
    value.latitude != null && value.longitude != null
      ? { lat: Number(value.latitude), lng: Number(value.longitude) }
      : null,
  )
  const searchSequence = useRef(0)
  const selectedQuery = useRef('')
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const adminReady = Boolean(value.region_code && value.city_code && value.barangay_code)
  const query = String(value.street || '').trim()
  const confirmed = Boolean(value.coordinate_confirmation_token)

  const locationContext = useMemo(() => ({
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
  }), [context, query, value.barangay, value.barangay_code, value.city, value.city_code, value.province, value.province_code, value.region, value.region_code])

  useEffect(() => {
    if (!adminReady || query.length < 3 || selectedQuery.current === query) return undefined
    const sequence = ++searchSequence.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setSearchError('')
      setActiveIndex(-1)
      try {
        const response = await searchPreciseLocations(locationContext)
        if (sequence !== searchSequence.current) return
        const data = response?.data ?? response
        setSuggestions(Array.isArray(data?.candidates) ? data.candidates : [])
        setTraceId(data?.trace_id || '')
        setProvider(data?.provider || 'google_geocoding')
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
    }, 400)
    return () => window.clearTimeout(timer)
  }, [adminReady, locationContext, query])

  const clearConfirmation = useCallback((changes = {}) => onChange({
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
  }), [onChange, value])

  const applyCandidate = useCallback((candidate, nextTraceId = traceId) => {
    const nextPin = { lat: Number(candidate.lat), lng: Number(candidate.lng) }
    const displayName = String(candidate.name || query).trim()
    selectedQuery.current = displayName
    setSelected(candidate)
    setPin(nextPin)
    setShowMap(true)
    setSuggestions([])
    setActiveIndex(-1)
    onChange({
      ...value,
      street: displayName,
      latitude: nextPin.lat,
      longitude: nextPin.lng,
      geocoding_trace_id: nextTraceId,
      coordinate_confirmation_token: '',
      coordinate_source: 'autocomplete_selection',
      coordinate_provider: candidate.provider || provider || 'google_geocoding',
      coordinate_place_id: candidate.place_id || '',
      coordinate_label: candidate.label || candidate.name || '',
      coordinate_confirmed_at: '',
    })
  }, [onChange, provider, query, traceId, value])

  const selectSuggestion = (candidate) => applyCandidate(candidate)

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
      coordinate_label: value.coordinate_label || query,
      coordinate_confirmed_at: '',
    })
  }

  const geocodeAndShowMap = async () => {
    if (!adminReady || query.length < 3) return
    setManualGeocoding(true)
    setSearchError('')
    try {
      const response = await geocodeManualAddress(locationContext)
      const data = response?.data ?? response
      const candidate = data?.candidate
      if (!candidate) {
        setSearchError('Google could not geocode this address. Try a nearby landmark or adjust the text.')
        return
      }
      applyCandidate(candidate, data?.trace_id || traceId)
      setTraceId(data?.trace_id || traceId)
      setProvider(data?.provider || 'google_geocoding')
    } catch (err) {
      setSearchError(err.message || 'Could not geocode this address.')
    } finally {
      setManualGeocoding(false)
    }
  }

  const startManualPin = async () => {
    if (suggestions[0]) {
      applyCandidate(suggestions[0])
      return
    }
    await geocodeAndShowMap()
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
        coordinate_place_id: selected?.place_id || value.coordinate_place_id || '',
        coordinate_label: selected?.label || value.coordinate_label || query,
        coordinate_confirmed_at: new Date().toISOString(),
      })
    } catch (err) {
      setSearchError(err.message || 'Could not confirm this map location.')
    } finally {
      setConfirming(false)
    }
  }

  const handleInputKeyDown = (event) => {
    if (suggestions.length === 0) {
      if (event.key === 'Enter' && query.length >= 3 && !showMap) {
        event.preventDefault()
        startManualPin()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const option = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const center = useMemo(() => pin ? [pin.lat, pin.lng] : PHILIPPINES_CENTER, [pin])

  return (
    <div className="dx-precise-location">
      <label className="dx-psgc-address__field dx-psgc-address__field--full">
        <span className="dx-wiz-label-text">Place / Street / Building / House No.{required ? ' *' : ''}</span>
        <div className="dx-precise-location__search-wrap">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            id={`${idPrefix}-street`}
            className={`dx-wiz-input dx-psgc-address__input${error ? ' dx-wiz-input--error' : ''}`}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-expanded={suggestions.length > 0}
            aria-controls={suggestions.length > 0 ? `${idPrefix}-suggestions` : undefined}
            aria-activedescendant={activeIndex >= 0 ? `${idPrefix}-suggestion-${activeIndex}` : undefined}
            role="combobox"
            value={value.street || ''}
            disabled={!adminReady}
            autoComplete="off"
            onKeyDown={handleInputKeyDown}
            onChange={(event) => {
              selectedQuery.current = ''
              setSelected(null)
              setPin(null)
              setShowMap(false)
              setActiveIndex(-1)
              clearConfirmation({ street: event.target.value })
            }}
            placeholder={adminReady ? 'Search a place, school, building, or street (e.g. FEU)' : 'Select the barangay first'}
          />
          {(loading || manualGeocoding) && (
            <Loader2 size={17} className="dx-precise-location__spinner" aria-label="Searching" />
          )}
        </div>
        {error && <span className="dx-psgc-address__field-error" role="alert">{error}</span>}
      </label>

      {suggestions.length > 0 && (
        <div
          ref={listRef}
          id={`${idPrefix}-suggestions`}
          className="dx-precise-location__suggestions"
          role="listbox"
          aria-label="Address suggestions"
        >
          {suggestions.map((candidate, index) => (
            <button
              key={candidate.id}
              id={`${idPrefix}-suggestion-${index}`}
              data-index={index}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? 'is-active' : ''}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectSuggestion(candidate)}
            >
              <MapPin size={16} aria-hidden />
              <span>
                <strong>{highlightMatches(candidate.name || candidate.label, candidate.matched_substrings)}</strong>
                <small>{candidate.secondary_label || candidate.label}</small>
              </span>
              <em>{candidate.type}</em>
            </button>
          ))}
        </div>
      )}

      {adminReady && query.length >= 3 && !showMap && !loading && (
        <button
          type="button"
          className="btn-dx-secondary btn-sm dx-precise-location__manual"
          disabled={manualGeocoding}
          onClick={startManualPin}
        >
          {manualGeocoding ? 'Geocoding address…' : 'No exact result? Geocode and place the pin manually'}
        </button>
      )}

      {showMap && pin && (
        <div className="dx-precise-location__map-card">
          <div className="dx-precise-location__map-copy">
            <strong>Optional: refine the exact entrance or loading point</strong>
            <span>Drag the marker for extra accuracy, or continue without confirming — Google coordinates from your selection will still be saved.</span>
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
                {confirming ? 'Confirming…' : 'Confirm pin (optional)'}
              </button>
            )}
          </div>
        </div>
      )}

      {searchError && <p className="dx-psgc-address__error" role="alert">{searchError}</p>}
    </div>
  )
}
