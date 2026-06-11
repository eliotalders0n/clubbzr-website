'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, item: T) => React.ReactNode
}

interface Action<T> {
  label: string
  onClick: (item: T) => void
  variant?: 'default' | 'danger'
}

interface DataTableProps<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
  actions?: Action<T>[]
  searchable?: boolean
  pagination?: boolean
  pageSize?: number
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  actions,
  searchable = true,
  pagination = true,
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [openActions, setOpenActions] = useState<string | null>(null)

  const filteredData = data.filter((item) =>
    Object.values(item).some((value) =>
      String(value).toLowerCase().includes(search.toLowerCase())
    )
  )

  const sortedData = sortKey
    ? [...filteredData].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey]
        const bVal = (b as Record<string, unknown>)[sortKey]
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    : filteredData

  const paginatedData = pagination
    ? sortedData.slice(page * pageSize, (page + 1) * pageSize)
    : sortedData

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const getValue = (item: T, key: string): unknown => {
    return (item as Record<string, unknown>)[key]
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="flex justify-between items-center">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-xs"
          />
          <span className="text-gray-500 text-sm">
            {filteredData.length} items
          </span>
        </div>
      )}

      <div className="glass rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                  className={cn(
                    'px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:text-bzr-white'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="px-6 py-4 w-20" />}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {paginatedData.map((item) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'border-b border-gray-800/50 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-800/30'
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 text-sm text-bzr-white"
                    >
                      {column.render
                        ? column.render(getValue(item, String(column.key)), item)
                        : String(getValue(item, String(column.key)) ?? '')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenActions(openActions === item.id ? null : item.id)
                        }}
                        className="text-gray-400 hover:text-bzr-white"
                      >
                        •••
                      </button>
                      <AnimatePresence>
                        {openActions === item.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-6 top-12 z-10 glass rounded-lg py-2 min-w-[120px]"
                          >
                            {actions.map((action) => (
                              <button
                                key={action.label}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  action.onClick(item)
                                  setOpenActions(null)
                                }}
                                className={cn(
                                  'w-full px-4 py-2 text-left text-sm transition-colors',
                                  action.variant === 'danger'
                                    ? 'text-red-400 hover:bg-red-500/10'
                                    : 'text-gray-300 hover:bg-gray-800'
                                )}
                              >
                                {action.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
