import { useCallback, useEffect, useRef, useState } from 'react'
import { EXPORT_PROGRESS_STEPS } from '../utils/audit/exportConfig'

export function useExportWorkflow({ onExport, onSaveSession }) {
  const [phase, setPhase] = useState('form')
  const [progressStep, setProgressStep] = useState(0)
  const [exportResult, setExportResult] = useState(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [exportError, setExportError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewUrlRef = useRef(null)

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPdfPreviewUrl(null)
  }, [])

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl])

  const resetWorkflow = useCallback(() => {
    setPhase('form')
    setExportResult(null)
    setExportError('')
    setProgressStep(0)
    revokePreviewUrl()
  }, [revokePreviewUrl])

  const triggerDownload = useCallback((result) => {
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const runExport = useCallback(async (format, params, { autoDownload = true } = {}) => {
    setPhase('progress')
    setExportError('')
    setProgressStep(0)
    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, EXPORT_PROGRESS_STEPS.length - 1)
      setProgressStep(step)
    }, 700)

    try {
      onSaveSession?.(format, params)
      const result = await onExport(format, params)
      clearInterval(interval)
      setProgressStep(EXPORT_PROGRESS_STEPS.length - 1)
      setExportResult(result)
      setPhase('success')
      if (autoDownload) triggerDownload(result)
      return result
    } catch (err) {
      clearInterval(interval)
      setExportError(err.message || 'Export failed.')
      setPhase('form')
      throw err
    }
  }, [onExport, onSaveSession, triggerDownload])

  const runPdfPreview = useCallback(async (params) => {
    setPreviewLoading(true)
    setExportError('')
    revokePreviewUrl()
    try {
      const result = await onExport('pdf', params)
      const url = URL.createObjectURL(result.blob)
      previewUrlRef.current = url
      setPdfPreviewUrl(url)
      setExportResult(result)
      setPhase('pdf-preview')
    } catch (err) {
      setExportError(err.message || 'PDF preview failed.')
    } finally {
      setPreviewLoading(false)
    }
  }, [onExport, revokePreviewUrl])

  const downloadAgain = useCallback(() => {
    if (exportResult) triggerDownload(exportResult)
  }, [exportResult, triggerDownload])

  const backToForm = useCallback(() => {
    revokePreviewUrl()
    setPhase('form')
  }, [revokePreviewUrl])

  return {
    phase,
    setPhase,
    progressStep,
    exportResult,
    pdfPreviewUrl,
    exportError,
    setExportError,
    previewLoading,
    resetWorkflow,
    runExport,
    runPdfPreview,
    downloadAgain,
    backToForm,
    triggerDownload,
  }
}
