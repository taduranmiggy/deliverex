import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  fetchPsgcBarangays,
  fetchPsgcCities,
  fetchPsgcProvinces,
  fetchPsgcRegions,
} from '../api/psgc'
import { emptyPsgcAddress, isCompletePsgcAddress } from '../utils/psgcAddress'
import {
  findBestPsgcMatch,
  normalizeSearchKey,
  sanitizePsgcName,
} from '../utils/textNormalize'

const EMPTY_DOWNSTREAM = {
  province_code: '', province: '', city_code: '', city: '', barangay_code: '', barangay: '',
}

function PsgcDirectoryCombobox({
  label,
  options,
  selectedName,
  onSelect,
  disabled,
  loading,
  required = true,
  error = '',
  fieldKey,
}) {
  const listboxId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selectedName || '')

  const sanitizedOptions = useMemo(
    () => options.map((option) => ({
      ...option,
      name: sanitizePsgcName(option.name),
    })),
    [options],
  )

  useEffect(() => {
    if (!open) setQuery(selectedName || '')
  }, [selectedName, open])

  useEffect(() => {
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const key = normalizeSearchKey(query)
    if (!key) return sanitizedOptions.slice(0, 50)
    return sanitizedOptions
      .filter((option) => normalizeSearchKey(option.name).includes(key))
      .slice(0, 50)
  }, [sanitizedOptions, query])

  const selectOption = (option) => {
    onSelect(option)
    setQuery(sanitizePsgcName(option.name))
    setOpen(false)
  }

  const resolveSelection = () => {
    const match = findBestPsgcMatch(query, sanitizedOptions)
    if (match) {
      selectOption(match)
      return
    }
    setQuery(selectedName || '')
    setOpen(false)
  }

  const handleInputChange = (event) => {
    const next = event.target.value.toUpperCase()
    setQuery(next)
    setOpen(true)
    const match = findBestPsgcMatch(next, sanitizedOptions)
    if (match) onSelect(match)
  }

  const isDisabled = disabled || loading
  const displayValue = selectedName || ''
  const inputValue = open ? query : displayValue

  return (
    <label className="dx-psgc-address__field" ref={rootRef}>
      <span className="dx-wiz-label-text">{label}{required ? ' *' : ''}</span>
      <div className={`dx-psgc-address__input-wrap${open ? ' dx-psgc-address__input-wrap--open' : ''}`}>
        <input
          ref={inputRef}
          id={fieldKey}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-invalid={error ? 'true' : undefined}
          className={`dx-wiz-input dx-psgc-address__input${error ? ' dx-wiz-input--error' : ''}`}
          value={inputValue}
          disabled={isDisabled}
          required={required}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore="true"
          placeholder={loading ? `Loading ${label.toLowerCase()}…` : `Search ${label.toLowerCase()}…`}
          onFocus={() => {
            if (isDisabled) return
            setOpen(true)
            setQuery(displayValue)
          }}
          onChange={handleInputChange}
          onBlur={() => {
            window.setTimeout(resolveSelection, 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const match = findBestPsgcMatch(query, sanitizedOptions) || (filtered.length === 1 ? filtered[0] : null)
              if (match) selectOption(match)
              else resolveSelection()
            }
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery(displayValue)
            }
          }}
        />
        <span className="dx-psgc-address__chevron" aria-hidden>
          {loading ? '⌛' : '⌄'}
        </span>
        {open && !isDisabled && (
          <div id={listboxId} className="dx-psgc-address__dropdown" role="listbox">
            {filtered.length === 0 ? (
              <div className="dx-psgc-address__dropdown-empty">No matching {label.toLowerCase()} found.</div>
            ) : (
              filtered.map((option) => {
                const selected = sanitizePsgcName(option.name) === displayValue
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`dx-psgc-address__dropdown-option${selected ? ' dx-psgc-address__dropdown-option--selected' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    {sanitizePsgcName(option.name)}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
      {error && (
        <span className="dx-psgc-address__field-error" role="alert">{error}</span>
      )}
    </label>
  )
}

export default function PsgcAddressSelector({
  value,
  onChange,
  title,
  required = true,
  legacyAddress = '',
  fieldErrors = {},
  idPrefix = 'psgc',
}) {
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
    const barangay = /^(barangay|brgy\.?\s)/i.test(address.barangay)
      ? sanitizePsgcName(address.barangay)
      : `Barangay ${sanitizePsgcName(address.barangay)}`
    return [address.street, barangay, address.city, address.province, address.region, 'Philippines']
      .filter(Boolean)
      .filter((part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
      .map((part) => sanitizePsgcName(part))
      .join(', ')
  }, [address])

  const patch = (changes) => onChange({ ...address, ...changes })

  const selectRegion = (option) => {
    setProvinces([])
    setCities([])
    setBarangays([])
    patch({
      region_code: option.code,
      region: sanitizePsgcName(option.name),
      ...EMPTY_DOWNSTREAM,
    })
  }

  const selectProvince = (option) => {
    setCities([])
    setBarangays([])
    patch({
      province_code: option.code,
      province: sanitizePsgcName(option.name),
      city_code: '',
      city: '',
      barangay_code: '',
      barangay: '',
    })
  }

  const selectCity = (option) => {
    setBarangays([])
    patch({
      city_code: option.code,
      city: sanitizePsgcName(option.name),
      barangay_code: '',
      barangay: '',
    })
  }

  const selectBarangay = (option) => {
    patch({
      barangay_code: option.code,
      barangay: sanitizePsgcName(option.name),
    })
  }

  return (
    <fieldset className="dx-psgc-address dx-wiz-full" autoComplete="off">
      {title && <legend className="dx-psgc-address__legend">{title}</legend>}
      <div className="dx-psgc-address__grid">
        <PsgcDirectoryCombobox
          key={`region-${address.region_code}-${address.region}`}
          fieldKey={`${idPrefix}-region`}
          label="Region"
          options={regions}
          selectedName={address.region}
          loading={loading.regions}
          required={required}
          error={fieldErrors.region}
          onSelect={selectRegion}
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
          <PsgcDirectoryCombobox
            key={`province-${address.province_code}-${address.province}`}
            fieldKey={`${idPrefix}-province`}
            label="Province"
            options={provinces}
            selectedName={address.province}
            disabled={!address.region_code}
            loading={loading.provinces}
            required={required}
            error={fieldErrors.province}
            onSelect={selectProvince}
          />
        )}
        <PsgcDirectoryCombobox
          key={`city-${address.city_code}-${address.city}`}
          fieldKey={`${idPrefix}-city`}
          label="City / Municipality"
          options={cities}
          selectedName={address.city}
          disabled={!address.region_code || (!independentRegion && !address.province_code)}
          loading={loading.cities}
          required={required}
          error={fieldErrors.city}
          onSelect={selectCity}
        />
        <PsgcDirectoryCombobox
          key={`barangay-${address.barangay_code}-${address.barangay}`}
          fieldKey={`${idPrefix}-barangay`}
          label="Barangay"
          options={barangays}
          selectedName={address.barangay}
          disabled={!address.city_code}
          loading={loading.barangays}
          required={required}
          error={fieldErrors.barangay}
          onSelect={selectBarangay}
        />
        <label className="dx-psgc-address__field dx-psgc-address__field--full">
          <span className="dx-wiz-label-text">Street / Building / House No.{required ? ' *' : ''}</span>
          <input
            id={`${idPrefix}-street`}
            className={`dx-wiz-input dx-psgc-address__input${fieldErrors.street ? ' dx-wiz-input--error' : ''}`}
            required={required}
            aria-invalid={fieldErrors.street ? 'true' : undefined}
            value={address.street || ''}
            onChange={(event) => patch({ street: event.target.value })}
            placeholder="e.g. 123 Rizal Avenue, Building A"
          />
          {fieldErrors.street && (
            <span className="dx-psgc-address__field-error" role="alert">{fieldErrors.street}</span>
          )}
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
