import { getPageRange, type PagedList } from '../../lib/logs'
import { Button } from './button'

interface PaginationProps {
  page: PagedList
  // Plural, e.g. "sessions".
  itemLabel: string
  // Shown after the count, e.g. "server time".
  note?: string
  onPageChange: (page: number) => void
}

export function Pagination({ page, itemLabel, note, onPageChange }: PaginationProps) {
  const range = getPageRange(page)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-ink-muted">
        Showing {range.firstItem}–{range.lastItem} of {page.totalItems} {itemLabel}
        {note && ` · ${note}`}
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
