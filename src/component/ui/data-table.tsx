import type { ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const cellVariants = cva('', {
  variants: {
    isRight: {
      true: 'text-right',
      false: 'text-left',
    },
    isMono: {
      true: 'font-mono text-sm whitespace-nowrap',
      false: '',
    },
  },
  defaultVariants: {
    isRight: false,
    isMono: false,
  },
})

export interface DataTableColumn<Row> {
  key: string
  label: string
  align?: 'right'
  isMono?: boolean
  render: (row: Row) => ReactNode
}

interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  minWidthClassName?: string
  emptyMessage: string
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  minWidthClassName,
  emptyMessage,
}: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-lg">
      <table
        className={cn(
          'w-full border-collapse border border-border bg-surface-200 text-base text-ink',
          minWidthClassName,
        )}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'border-b border-border-strong bg-surface-300 px-3 py-2 text-xs font-semibold tracking-label text-ink-muted',
                  cellVariants({ isRight: column.align === 'right' }),
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-surface-300">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'border-b border-border px-3 py-2.5 align-middle',
                      cellVariants({
                        isRight: column.align === 'right',
                        isMono: column.isMono,
                      }),
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
