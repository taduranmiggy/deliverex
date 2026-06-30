import { PaginationBar } from '../ui'
import { useClientPagination } from '../../hooks/useClientPagination'

export const CHATBOT_TABLE_PAGE_SIZE = 8

/**
 * Paginated admin table for Chatbot Management tabs.
 */
export default function ChatbotPaginatedTable({
  columns,
  rows,
  renderRow,
  emptyMessage = 'No records found.',
  perPage = CHATBOT_TABLE_PAGE_SIZE,
  pageResetKey = '',
  loading = false,
  loadingMessage = 'Loading…',
}) {
  const { page, total, slice, setPage } = useClientPagination(rows, { perPage, resetKey: pageResetKey })
  const colSpan = columns.length

  return (
    <div className="dx-chatbot-table-panel">
      <div className="dx-data-table-wrap dx-chatbot-table-wrap">
        <table className="dx-data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} style={{ color: 'var(--muted)', padding: 24 }}>
                  {loadingMessage}
                </td>
              </tr>
            ) : slice.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ color: 'var(--muted)', padding: 24 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((row, index) => renderRow(row, index))
            )}
          </tbody>
        </table>
      </div>
      {!loading && total > 0 ? (
        <PaginationBar page={page} perPage={perPage} total={total} onPage={setPage} />
      ) : null}
    </div>
  )
}
