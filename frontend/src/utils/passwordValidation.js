export const PASSWORD_RULES = [
  { key: 'length', label: 'Minimum 8 characters', test: (value) => value.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', label: 'Lowercase letter', test: (value) => /[a-z]/.test(value) },
  { key: 'number', label: 'Number', test: (value) => /\d/.test(value) },
  { key: 'special', label: 'Special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

export function computePasswordStrength(value) {
  if (!value) return { score: 0, label: 'Weak', tone: 'weak' }
  const score = PASSWORD_RULES.reduce((acc, rule) => acc + (rule.test(value) ? 1 : 0), 0)
  if (score <= 2) return { score, label: 'Weak', tone: 'weak' }
  if (score === 3) return { score, label: 'Fair', tone: 'fair' }
  if (score === 4) return { score, label: 'Good', tone: 'good' }
  return { score, label: 'Strong', tone: 'strong' }
}

export function allPasswordRulesPassed(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

export function passwordRuleStates(value) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(value) }))
}
