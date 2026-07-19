export function emptyPsgcAddress() {
  return {
    region_code: '', region: '', province_code: '', province: '',
    city_code: '', city: '', barangay_code: '', barangay: '', street: '',
  }
}

export function toPsgcAddress(source = {}, prefix = 'address') {
  const key = (suffix) => source[`${prefix}_${suffix}`] ?? ''
  return {
    region_code: key('region_code'),
    region: key('region'),
    province_code: key('province_code'),
    province: key('province'),
    city_code: key('city_code'),
    city: key('city'),
    barangay_code: key('barangay_code'),
    barangay: key('barangay'),
    street: key('street'),
  }
}

export function fromPsgcAddress(address, prefix = 'address') {
  return {
    [`${prefix}_region_code`]: address.region_code || null,
    [`${prefix}_region`]: address.region || null,
    [`${prefix}_province_code`]: address.province_code || null,
    [`${prefix}_province`]: address.province || null,
    [`${prefix}_city_code`]: address.city_code || null,
    [`${prefix}_city`]: address.city || null,
    [`${prefix}_barangay_code`]: address.barangay_code || null,
    [`${prefix}_barangay`]: address.barangay || null,
    [`${prefix}_street`]: address.street || null,
  }
}

export function isCompletePsgcAddress(address) {
  return Boolean(address?.region_code && address?.city_code && address?.barangay_code && address?.street?.trim())
}

/**
 * @param {ReturnType<typeof emptyPsgcAddress>} address
 * @param {{ requiresProvince?: boolean }} [options]
 */
export function getPsgcAddressFieldErrors(address, options = {}) {
  const { requiresProvince = false } = options
  const errors = {}

  if (!address?.region_code) {
    errors.region = 'Select a region from the list.'
  }
  if (requiresProvince && !address?.province_code) {
    errors.province = 'Select a province from the list.'
  }
  if (!address?.city_code) {
    errors.city = 'Select a city or municipality from the list.'
  }
  if (!address?.barangay_code) {
    errors.barangay = 'Select a barangay from the list.'
  }
  if (!address?.street?.trim()) {
    errors.street = 'Street / building / house no. is required.'
  }

  return errors
}

/**
 * @param {ReturnType<typeof getPsgcAddressFieldErrors>} fieldErrors
 */
export function getPsgcAddressSummaryError(fieldErrors) {
  const messages = Object.values(fieldErrors || {})
  if (messages.length === 0) return ''
  if (messages.length === 1) return messages[0]
  return 'Complete the address using the PSGC selections.'
}
