/** @param {Record<string, unknown>|null|undefined} company */
export function companyHasStructuredAddress(company) {
  if (!company) return false
  return Boolean(
    company.address_street
    || company.address_barangay
    || company.address_city
    || company.address_province,
  )
}

/** @param {Record<string, unknown>|null|undefined} company */
export function companyDropoffFields(company) {
  if (!companyHasStructuredAddress(company)) {
    return null
  }

  return {
    dropoff_street: String(company.address_street ?? '').trim(),
    dropoff_barangay: String(company.address_barangay ?? '').trim(),
    dropoff_city: String(company.address_city ?? '').trim(),
    dropoff_province: String(company.address_province ?? '').trim(),
    dropoff_location: [
      company.address_street,
      company.address_barangay,
      company.address_city,
      company.address_province,
    ].filter(Boolean).join(', '),
  }
}
