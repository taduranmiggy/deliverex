import { apiRequest } from './client'

const segment = (value) => encodeURIComponent(String(value || ''))

async function list(path) {
  const response = await apiRequest(path)
  return Array.isArray(response?.data) ? response.data : []
}

export const fetchPsgcRegions = () => list('/psgc/regions')

export const fetchPsgcProvinces = (regionCode) =>
  list(`/psgc/regions/${segment(regionCode)}/provinces`)

export const fetchPsgcCities = (regionCode, provinceCode = '') =>
  provinceCode
    ? list(`/psgc/regions/${segment(regionCode)}/provinces/${segment(provinceCode)}/cities-municipalities`)
    : list(`/psgc/regions/${segment(regionCode)}/cities-municipalities`)

export const fetchPsgcBarangays = (regionCode, cityCode, provinceCode = '') =>
  provinceCode
    ? list(`/psgc/regions/${segment(regionCode)}/provinces/${segment(provinceCode)}/cities-municipalities/${segment(cityCode)}/barangays`)
    : list(`/psgc/regions/${segment(regionCode)}/cities-municipalities/${segment(cityCode)}/barangays`)
