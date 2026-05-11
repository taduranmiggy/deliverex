import { useState } from 'react'
import { uploadDocument } from '../../api/driver'
import useOnlineStatus from '../../hooks/useOnlineStatus'

function DocumentUploadPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isOnline = useOnlineStatus()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!isOnline) {
      setError('Document upload requires an online connection.')
      return
    }

    const formData = new FormData(event.target)

    try {
      await uploadDocument(formData)
      setMessage('Document uploaded and queued for OCR.')
      event.target.reset()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Document Upload</h1>
        <p>Attach proof of delivery, receipts, and gate passes.</p>
      </header>
      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Assignment ID
          <input name="assignment_id" type="number" placeholder="Assignment ID" required />
        </label>
        <label>
          Document Type
          <input name="type" type="text" placeholder="pod, receipt, gate_pass" />
        </label>
        <label>
          File
          <input name="file" type="file" required />
        </label>
        {message && <p className="banner success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">Upload Document</button>
      </form>
    </section>
  )
}

export default DocumentUploadPage
