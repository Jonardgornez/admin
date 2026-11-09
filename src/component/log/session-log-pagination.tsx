import { getPageRange } from '../../lib/logs'
import type { SessionLogPage } from '../../types'
import { Button } from '../ui/button'

interface SessionLogPaginationProps {
  page: SessionLogPage
  onPageChange: (page: number) => void
}

export function SessionLogPagination({ page, onPageChange }: SessionLogPaginationProps) {
  const range = getPageRange(page)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-ink-muted">
        Showing {range.firstItem}–{range.lastItem} of {page.totalItems} sessions · server time
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page.page <= 1}
          onClick={() => onPageChange(page.page - 1)}
        >
          Previous
        </Button>
        <span className="text-ink-muted">
          Page {page.page} of {range.totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page.page >= range.totalPages}
          onClick={() => onPageChange(page.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
