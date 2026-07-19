/**
 * Composite cities (e.g. City of Manila) have zero direct barangays; PSGC lists
 * their districts as SubMun entries in the same city list.
 *
 * @param {Array<{ code?: string, type?: string }>} cities
 */
export function filterSelectablePsgcCities(cities = []) {
  if (!Array.isArray(cities) || cities.length === 0) return []

  return cities.filter((city) => !isCompositeParentCity(city, cities))
}

function isCompositeParentCity(city, cities) {
  const code = String(city?.code || '')
  if (city?.type !== 'City' || !code.endsWith('0000')) return false

  return cities.some((candidate) => (
    candidate?.type === 'SubMun'
    && String(candidate?.code || '') !== code
    && isSubMunicipalityOf(String(candidate?.code || ''), code)
  ))
}

function isSubMunicipalityOf(subCode, parentCityCode) {
  if (subCode.length !== 10 || parentCityCode.length !== 10) return false
  if (subCode === parentCityCode || !parentCityCode.endsWith('0000')) return false
  return subCode.startsWith(parentCityCode.slice(0, 5))
}
