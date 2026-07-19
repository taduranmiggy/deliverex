import { formatAddressParts } from './jobOrderAddressValidation'

/** @param {Record<string, unknown>|null|undefined} company */
export function companyHasStructuredAddress(company) {
  if (!company) return false
  return Boolean(
    company.address_region_code
    && company.address_city_code
    && company.address_barangay_code
    && company.address_street,
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
    dropoff_region_code: company.address_region_code || '',
    dropoff_region: company.address_region || '',
    dropoff_province_code: company.address_province_code || '',
    dropoff_barangay: barangay,
    dropoff_barangay_code: company.address_barangay_code || '',
    dropoff_city: city,
    dropoff_city_code: company.address_city_code || '',
    dropoff_province: province,
    dropoff_location: formatAddressParts([street, barangay, city, province]),
  }
}
