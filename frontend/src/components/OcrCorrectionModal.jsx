import { Loader2, X } from 'lucide-react'

export const OCR_CORRECTION_ISSUE_TYPES = [
  { value: 'ocr_misread', label: 'OCR Misread' },
  { value: 'wrong_unit', label: 'Wrong Unit' },
  { value: 'missing_value', label: 'Missing Value' },
  { value: 'incorrect_format', label: 'Incorrect Format' },
  { value: 'low_ocr_accuracy', label: 'Low OCR Accuracy' },
  { value: 'supplier_layout_difference', label: 'Supplier Layout Difference' },
  { value: 'other', label: 'Other' },
]

function OcrCorrectionModal({
  open,
  onClose,
  onConfirm,
  issueType,
  onIssueTypeChange,
  reason,
  onReasonChange,
  errors = {},
  saving = false,
  changedFieldCount = 0,
}) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-correction-modal-title"
      onClick={onClose}
      className="ocr-correction-modal__backdrop"
    >
      <div className="dx-pop-in ocr-correction-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ocr-correction-modal__header">
          <strong id="ocr-correction-modal-title">Correction accountability</strong>
          <button type="button" onClick={onClose} aria-label="Close" className="ocr-correction-modal__close">
            <X size={18} />
          </button>
        </div>

        <div className="ocr-correction-modal__body">
          <p className="ocr-correction-modal__intro">
            {changedFieldCount === 1
              ? '1 field will be updated. Provide an issue type and reason for the audit trail.'
              : `${changedFieldCount} fields will be updated. Provide an issue type and reason for the audit trail.`}
          </p>

          <label className="ocr-correction-modal__field">
            <span>Issue Type <span className="ocr-correction-modal__required">*</span></span>
            <select
              value={issueType}
              onChange={(e) => onIssueTypeChange(e.target.value)}
              className={errors.issue_type ? 'dx-wiz-input dx-wiz-input--error' : 'dx-wiz-input'}
            >
              <option value="">Select issue type</option>
              {OCR_CORRECTION_ISSUE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.issue_type && <span className="ocr-correction-modal__error">{errors.issue_type}</span>}
          </label>

          <label className="ocr-correction-modal__field">
            <span>Reason <span className="ocr-correction-modal__required">*</span></span>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Explain why the OCR value was corrected..."
              maxLength={500}
              className={errors.reason ? 'dx-wiz-input dx-wiz-input--error' : undefined}
            />
            <span className="ocr-correction-modal__counter">{reason.length}/500</span>
            {errors.reason && <span className="ocr-correction-modal__error">{errors.reason}</span>}
          </label>
        </div>

        <div className="ocr-correction-modal__footer">
          <button type="button" className="btn-dx-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-dx-primary" onClick={onConfirm} disabled={saving}>
            {saving
              ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
              : 'Save corrections'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OcrCorrectionModal
