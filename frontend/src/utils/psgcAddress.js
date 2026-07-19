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
