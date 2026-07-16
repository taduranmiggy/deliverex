import { formatAddressParts } from './jobOrderAddressValidation'

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

  const street = String(company.address_street ?? '').trim()
  const barangay = String(company.address_barangay ?? '').trim()
  const city = String(company.address_city ?? '').trim()
  const province = String(company.address_province ?? '').trim()

  return {
    dropoff_street: street,
    dropoff_barangay: barangay,
    dropoff_city: city,
    dropoff_province: province,
    dropoff_location: formatAddressParts([street, barangay, city, province]),
  }
}
