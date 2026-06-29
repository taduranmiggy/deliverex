import { sanitizeMiddleInitial } from '../utils/nameParts.js'

export function UserNameFields({
  values,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = 'user-name',
}) {
  const set = (key) => (e) => {
    let next = e.target.value
    if (key === 'middle_initial') {
      next = sanitizeMiddleInitial(next)
    }
    onChange({ ...values, [key]: next })
  }

  return (
    <div className="dx-name-fields">
      <label className="dx-name-fields__field">
        <span>First name <span className="dx-required">*</span></span>
        <input
          id={`${idPrefix}-first`}
          required
          value={values.first_name ?? ''}
          onChange={set('first_name')}
          placeholder="Juan"
          disabled={disabled}
          aria-invalid={errors.first_name ? 'true' : undefined}
        />
        {errors.first_name && <span className="form-error">{errors.first_name}</span>}
      </label>
      <label className="dx-name-fields__field dx-name-fields__field--mi">
        <span>Middle initial</span>
        <input
          id={`${idPrefix}-middle`}
          value={values.middle_initial ?? ''}
          onChange={set('middle_initial')}
          placeholder="D"
          maxLength={2}
          disabled={disabled}
          aria-invalid={errors.middle_initial ? 'true' : undefined}
        />
        {errors.middle_initial && <span className="form-error">{errors.middle_initial}</span>}
      </label>
      <label className="dx-name-fields__field">
        <span>Last name <span className="dx-required">*</span></span>
        <input
          id={`${idPrefix}-last`}
          required
          value={values.last_name ?? ''}
          onChange={set('last_name')}
          placeholder="Cruz"
          disabled={disabled}
          aria-invalid={errors.last_name ? 'true' : undefined}
        />
        {errors.last_name && <span className="form-error">{errors.last_name}</span>}
      </label>
    </div>
  )
}

export default UserNameFields
