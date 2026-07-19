import { useCallback, useMemo, useState } from 'react'
import EnterpriseExportModal from '../export/EnterpriseExportModal'
import { exportAuditLogs } from '../../api/admin'
import {
  AUDIT_ACTION_CATEGORIES,
  AUDIT_EXPORT_MODULES,
  AUDIT_EXPORT_ROLES,
} from '../../utils/audit/exportConfig'

function AuditExportModal({ open, onClose, initialFilters = {}, userOptions = [] }) {
  const [modules, setModules] = useState([])
  const [actionCategories, setActionCategories] = useState([])
  const [user, setUser] = useState('all')
  const [role, setRole] = useState('all')

  const buildExtraParams = useCallback(() => {
    const extra = {
      sort: initialFilters.sort ?? 'desc',
    }
    if (modules.length) extra.modules = modules
    else if (initialFilters.module) extra.module = initialFilters.module
    if (actionCategories.length) extra.action_categories = actionCategories
    if (user !== 'all') extra.user = user
    if (role !== 'all') extra.role = role
    if (initialFilters.search) extra.search = initialFilters.search
    return extra
  }, [modules, actionCategories, user, role, initialFilters])

  const toggleModule = (key) => {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]))
  }

  const toggleAction = (key) => {
    setActionCategories((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]))
  }

  const auditFilters = useMemo(() => (
    <>
      <section className="dx-audit-export-section">
        <div className="dx-audit-export-section__head">
          <h3>Modules</h3>
          <button type="button" className="dx-link-btn" onClick={() => setModules(AUDIT_EXPORT_MODULES.map((m) => m.key))}>Select All</button>
        </div>
        <div className="dx-audit-export-checkgrid">
          {AUDIT_EXPORT_MODULES.map((m) => (
            <label key={m.key}><input type="checkbox" checked={modules.includes(m.key)} onChange={() => toggleModule(m.key)} /> {m.label}</label>
          ))}
        </div>
      </section>

      <section className="dx-audit-export-section">
        <h3>Actions</h3>
        <div className="dx-audit-export-checkgrid">
          {AUDIT_ACTION_CATEGORIES.map((a) => (
            <label key={a.key}><input type="checkbox" checked={actionCategories.includes(a.key)} onChange={() => toggleAction(a.key)} /> {a.label}</label>
          ))}
        </div>
      </section>

      <section className="dx-audit-export-section dx-audit-export-section--grid2">
        <label>Users
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="all">All Users</option>
            {userOptions.filter((u) => u.value !== 'all').map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </label>
        <label>Roles
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {AUDIT_EXPORT_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
      </section>
    </>
  ), [modules, actionCategories, user, role, userOptions])

  return (
    <EnterpriseExportModal
      open={open}
      onClose={onClose}
      sessionKey="audit_logs"
      previewReportKey="audit_logs"
      title="Export Audit Report"
      subtitle="Choose what data you want to export."
      onExport={exportAuditLogs}
      initialFilters={initialFilters}
      defaultFormat="pdf"
      buildExtraParams={buildExtraParams}
    >
      {auditFilters}
    </EnterpriseExportModal>
  )
}

export default AuditExportModal
