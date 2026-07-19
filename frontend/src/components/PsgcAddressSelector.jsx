import { useEffect, useId, useMemo, useState } from 'react'
import {
  fetchPsgcBarangays,
  fetchPsgcCities,
  fetchPsgcProvinces,
  fetchPsgcRegions,
} from '../api/psgc'
import { emptyPsgcAddress, isCompletePsgcAddress } from '../utils/psgcAddress'

const EMPTY_DOWNSTREAM = {
  province_code: '', province: '', city_code: '', city: '', barangay_code: '', barangay: '',
}

function SearchableDirectoryField({ label, options, name, onSelect, disabled, loading, required = true }) {
  const listId = useId()
  const [query, setQuery] = useState(name || '')

  const exactMatch = (text) => options.find((option) =>
    String(option.name || '').localeCompare(String(text || '').trim(), undefined, { sensitivity: 'accent' }) === 0
  )

  return (
    <label className="dx-psgc-address__field">
      <span className="dx-wiz-label-text">{label}{required ? ' *' : ''}</span>
      <div className="dx-psgc-address__input-wrap">
        <input
          list={listId}
          className="dx-wiz-input dx-psgc-address__input"
          value={query}
          disabled={disabled || loading}
          required={required}
          autoComplete="off"
          placeholder={loading ? `Loading ${label.toLowerCase()}…` : `Search ${label.toLowerCase()}…`}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            const match = exactMatch(next)
            if (match) onSelect(match)
          }}
          onBlur={() => {
            const match = exactMatch(query)
            if (match) onSelect(match)
            else setQuery(name || '')
          }}
        />
        <span className="dx-psgc-address__chevron" aria-hidden>
          {loading ? '⌛' : '⌄'}
        </span>
        <datalist id={listId}>
          {options.map((option) => <option key={option.code} value={option.name} />)}
        </datalist>
      </div>
    </label>
  )
}

export default function PsgcAddressSelector({ value, onChange, title, required = true, legacyAddress = '' }) {
  const address = value || emptyPsgcAddress()
  const [regions, setRegions] = useState([])
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [loading, setLoading] = useState({ regions: true, provinces: false, cities: false, barangays: false })
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const rows = await fetchPsgcRegions()
        if (active) setRegions(rows)
      } catch (err) {
        if (active) setError(err.message || 'Could not load PSGC regions.')
      } finally {
        if (active) setLoading((state) => ({ ...state, regions: false }))
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!address.region_code) return undefined
    let active = true
    void (async () => {
      setError('')
      setLoading((state) => ({ ...state, provinces: true }))
      try {
        const rows = await fetchPsgcProvinces(address.region_code)
        if (!active) return
        setProvinces(rows)
        if (rows.length === 0) {
          setLoading((state) => ({ ...state, cities: true }))
          try {
            const cityRows = await fetchPsgcCities(address.region_code)
            if (active) setCities(cityRows)
          } catch (err) {
            if (active) setError(err.message || 'Could not load PSGC cities and municipalities.')
          } finally {
            if (active) setLoading((state) => ({ ...state, cities: false }))
          }
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load PSGC provinces.')
      } finally {
        if (active) setLoading((state) => ({ ...state, provinces: false }))
      }
    })()
    return () => { active = false }
  }, [address.region_code])

  useEffect(() => {
    if (!address.region_code || !address.province_code) return undefined
    let active = true
    void (async () => {
      setError('')
      setLoading((state) => ({ ...state, cities: true }))
      try {
        const rows = await fetchPsgcCities(address.region_code, address.province_code)
        if (active) setCities(rows)
      } catch (err) {
        if (active) setError(err.message || 'Could not load PSGC cities and municipalities.')
      } finally {
        if (active) setLoading((state) => ({ ...state, cities: false }))
      }
    })()
    return () => { active = false }
  }, [address.region_code, address.province_code])

  useEffect(() => {
    if (!address.region_code || !address.city_code) return undefined
    let active = true
    void (async () => {
      setError('')
      setLoading((state) => ({ ...state, barangays: true }))
      try {
        const rows = await fetchPsgcBarangays(address.region_code, address.city_code, address.province_code)
        if (active) setBarangays(rows)
      } catch (err) {
        if (active) setError(err.message || 'Could not load PSGC barangays.')
      } finally {
        if (active) setLoading((state) => ({ ...state, barangays: false }))
      }
    })()
    return () => { active = false }
  }, [address.region_code, address.province_code, address.city_code])

  const independentRegion = Boolean(address.region_code && !loading.provinces && provinces.length === 0)
  const formattedPreview = useMemo(() => {
    if (!isCompletePsgcAddress(address)) return ''
    const barangay = /^(barangay|brgy\.?\s)/i.test(address.barangay) ? address.barangay : `Barangay ${address.barangay}`
    return [address.street, barangay, address.city, address.province, address.region, 'Philippines']
      .filter(Boolean)
      .filter((part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
      .map((part) => part.toUpperCase())
      .join(', ')
  }, [address])

  const patch = (changes) => onChange({ ...address, ...changes })

  return (
    <fieldset className="dx-psgc-address dx-wiz-full">
      {title && <legend className="dx-psgc-address__legend">{title}</legend>}
      <div className="dx-psgc-address__grid">
        <SearchableDirectoryField
          key={`region-${address.region_code}-${address.region}`}
          label="Region" options={regions} name={address.region}
          loading={loading.regions} required={required}
          onSelect={(option) => {
            setProvinces([]); setCities([]); setBarangays([])
            patch({ region_code: option.code, region: option.name, ...EMPTY_DOWNSTREAM })
          }}
        />
        {independentRegion ? (
          <label className="dx-psgc-address__field">
            <span className="dx-wiz-label-text">Province / Administrative area</span>
            <input
              className="dx-wiz-input dx-psgc-address__input"
              value={`${address.region || 'Selected region'} (no PSGC province)`}
              disabled
            />
          </label>
        ) : (
          <SearchableDirectoryField
            key={`province-${address.province_code}-${address.province}`}
            label="Province" options={provinces} name={address.province}
            disabled={!address.region_code} loading={loading.provinces} required={required}
            onSelect={(option) => {
              setCities([]); setBarangays([])
              patch({ province_code: option.code, province: option.name, city_code: '', city: '', barangay_code: '', barangay: '' })
            }}
          />
        )}
        <SearchableDirectoryField
          key={`city-${address.city_code}-${address.city}`}
          label="City / Municipality" options={cities} name={address.city}
          disabled={!address.region_code || (!independentRegion && !address.province_code)} loading={loading.cities} required={required}
          onSelect={(option) => {
            setBarangays([])
            patch({ city_code: option.code, city: option.name, barangay_code: '', barangay: '' })
          }}
        />
        <SearchableDirectoryField
          key={`barangay-${address.barangay_code}-${address.barangay}`}
          label="Barangay" options={barangays} name={address.barangay}
          disabled={!address.city_code} loading={loading.barangays} required={required}
          onSelect={(option) => patch({ barangay_code: option.code, barangay: option.name })}
        />
        <label className="dx-psgc-address__field dx-psgc-address__field--full">
          <span className="dx-wiz-label-text">Street / Building / House No.{required ? ' *' : ''}</span>
          <input
            className="dx-wiz-input dx-psgc-address__input"
            required={required}
            value={address.street || ''}
            onChange={(event) => patch({ street: event.target.value })}
            placeholder="e.g. 123 Rizal Avenue, Building A"
          />
        </label>
      </div>
      {legacyAddress && !address.region_code && (
        <p className="dx-psgc-address__legacy">
          Legacy address: {legacyAddress}. Select the official PSGC divisions when changing this address.
        </p>
      )}
      {formattedPreview && (
        <div className="dx-psgc-address__preview">
          <strong>Formatted address preview</strong>
          <span>{formattedPreview}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="dx-psgc-address__error">
          {error} Existing selections are preserved; retry when the PSGC service is available.
        </p>
      )}
    </fieldset>
  )
}
