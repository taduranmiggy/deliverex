import { CheckCircle2, Download, FolderOpen, Loader2 } from 'lucide-react'
import { EXPORT_PROGRESS_STEPS } from '../../utils/audit/exportConfig'

export function ExportProgressPanel({ step = 0 }) {
  return (
    <div className="dx-audit-export-progress">
      <Loader2 size={42} className="dx-spin" />
      <h3>{EXPORT_PROGRESS_STEPS[step] ?? EXPORT_PROGRESS_STEPS[0]}</h3>
      <p>Please wait while your report is being generated.</p>
    </div>
  )
}

export function ExportSuccessPanel({ filename, onDownloadAgain, onClose }) {
  return (
    <div className="dx-audit-export-success">
      <CheckCircle2 size={48} className="dx-audit-export-success__icon" />
      <h3>Report exported successfully.</h3>
      <p>{filename}</p>
      <div className="dx-audit-export-success__actions">
        <button type="button" className="btn-dx-secondary" onClick={onDownloadAgain}>
          <Download size={15} /> Download Again
        </button>
        <button type="button" className="btn-dx-secondary" onClick={onClose}>
          <FolderOpen size={15} /> Close
        </button>
      </div>
    </div>
  )
}

export function PdfPreviewPanel({ url, filename, onBack, onExport, exporting = false }) {
  return (
    <div className="dx-export-pdf-preview">
      <div className="dx-export-pdf-preview__toolbar">
        <strong>PDF Preview</strong>
        <span>{filename}</span>
      </div>
      <iframe title="Report PDF preview" src={url} className="dx-export-pdf-preview__frame" />
      <div className="dx-export-pdf-preview__actions">
        <button type="button" className="btn-dx-secondary" onClick={onBack}>Back to filters</button>
        <button type="button" className="btn-dx-primary" onClick={onExport} disabled={exporting}>
          {exporting ? <><Loader2 size={15} className="dx-spin" /> Exporting…</> : <><Download size={15} /> Export PDF</>}
        </button>
      </div>
    </div>
  )
}
