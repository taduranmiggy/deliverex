/** Action badge colors for audit log table rows. */
export function getAuditActionStyle(action = '') {
  const a = String(action).toLowerCase()

  if (a.includes('delete')) {
    return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Deleted' }
  }
  if (a.includes('export') || a.includes('exported')) {
    return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Exported' }
  }
  if (a.includes('create') || a.includes('created') || a.includes('invite_sent')) {
    return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Created' }
  }
  if (a.includes('update') || a.includes('updated') || a.includes('changed') || a.includes('assigned') || a.includes('completed')) {
    return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Updated' }
  }
  if (a.includes('logout')) {
    return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', label: 'Logout' }
  }
  if (a.includes('login')) {
    return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: 'Login' }
  }
  if (a.includes('fail')) {
    return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'Failed' }
  }

  return { bg: '#f8fafc', color: '#334155', border: '#e2e8f0', label: 'Action' }
}

export function formatAuditAction(raw) {
  if (!raw) return '—'
  const parts = String(raw).split('.')
  const last = parts[parts.length - 1]
  return last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
