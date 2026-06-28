/**
 * Display-label normalizers — presentation only.
 * Backend module keys and audit action prefixes are unchanged.
 */

/** Map legacy audit/dashboard module labels to the unified OCR page title. */
export function normalizeOcrModuleLabel(label) {
  if (label === 'OCR Validation' || label === 'Delivery Documentation') return 'OCR Review'
  return label
}
