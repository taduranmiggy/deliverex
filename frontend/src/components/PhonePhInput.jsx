import { formatPhoneDraftForStorage, parsePhoneForInput, sanitizePhMobileInput } from '../utils/phonePh.js'

/**
 * Philippine mobile input with fixed +63 prefix.
 * value: stored phone (+639… or legacy 09…) — onChange receives stored format or ''.
 */
export function PhonePhInput({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  'aria-describedby': ariaDescribedBy,
}) {
  const digits = parsePhoneForInput(value)

  const handleChange = (e) => {
    const next = sanitizePhMobileInput(e.target.value)
    onChange(next ? formatPhoneDraftForStorage(next) : '')
  }

  return (
    <div className="dx-phone-ph">
      <span className="dx-phone-ph__prefix" aria-hidden="true">+63</span>
      <span className="dx-phone-ph__sep" aria-hidden="true">|</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className={`dx-phone-ph__input${error ? ' dx-phone-ph__input--error' : ''}`}
        value={digits}
        onChange={handleChange}
        placeholder="9123456789"
        maxLength={10}
        required={required}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  )
}

export default PhonePhInput
