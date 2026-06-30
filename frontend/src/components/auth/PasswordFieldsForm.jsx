import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  allPasswordRulesPassed,
  computePasswordStrength,
  passwordRuleStates,
} from '../../utils/passwordValidation'

/**
 * Shared new-password fields: show/hide toggles, strength meter, rule checklist, match hint.
 */
export default function PasswordFieldsForm({
  idPrefix = 'auth-password',
  password,
  passwordConfirmation,
  onPasswordChange,
  onPasswordConfirmationChange,
  newPasswordLabel = 'New password',
  confirmLabel = 'Confirm new password',
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  const ruleStates = useMemo(() => passwordRuleStates(password), [password])
  const strength = useMemo(() => computePasswordStrength(password), [password])
  const passwordsMatch = passwordConfirmation.length > 0 && password === passwordConfirmation
  const passwordsMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation

  return (
    <>
      <label className="auth-password-row auth-password-row--activation">
        <span>{newPasswordLabel}</span>
        <div className="auth-password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            aria-describedby={`${idPrefix}-rules ${idPrefix}-strength`}
          />
          <button
            type="button"
            className="auth-toggle-pw"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <div id={`${idPrefix}-strength`} className="activation-strength">
        <div className="activation-strength__bar-wrap" aria-hidden="true">
          <span className={`activation-strength__bar activation-strength__bar--${strength.tone} activation-strength__bar--fill-${strength.score}`} />
        </div>
        <p className={`activation-strength__label activation-strength__label--${strength.tone}`}>
          Password strength: <strong>{strength.label}</strong>
        </p>
      </div>

      <ul id={`${idPrefix}-rules`} className="activation-rules" aria-live="polite">
        {ruleStates.map((rule) => (
          <li key={rule.key} className={rule.ok ? 'is-complete' : ''}>
            <span aria-hidden="true">{rule.ok ? '✔' : '○'}</span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>

      <label className="auth-password-row auth-password-row--activation">
        <span>{confirmLabel}</span>
        <div className="auth-password-field">
          <input
            type={showPasswordConfirmation ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={passwordConfirmation}
            onChange={(e) => onPasswordConfirmationChange(e.target.value)}
            aria-describedby={`${idPrefix}-match`}
          />
          <button
            type="button"
            className="auth-toggle-pw"
            aria-label={showPasswordConfirmation ? 'Hide confirm password' : 'Show confirm password'}
            aria-pressed={showPasswordConfirmation}
            onClick={() => setShowPasswordConfirmation((prev) => !prev)}
          >
            {showPasswordConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <p
        id={`${idPrefix}-match`}
        className={`activation-match ${passwordsMatch ? 'is-match' : passwordsMismatch ? 'is-mismatch' : ''}`}
        aria-live="polite"
      >
        {passwordsMatch ? '✔ Passwords match' : passwordsMismatch ? '✖ Passwords do not match' : 'Passwords must match'}
      </p>
    </>
  )
}

export { allPasswordRulesPassed }
