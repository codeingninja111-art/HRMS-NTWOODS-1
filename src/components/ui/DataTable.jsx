import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';

function defaultCompare_(a, b) {
  const ax = a == null ? '' : a;
  const bx = b == null ? '' : b;
  return String(ax).localeCompare(String(bx), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable({
  columns,
  rows,
  getRowKey,
  onRowClick,
  initialSort,
  empty,
  className,
  maxHeight,
}) {
  const [sort, setSort] = useState(() => initialSort ?? { key: null, dir: 'asc' });
  const normalizedColumns = useMemo(() => (columns || []).filter(Boolean), [columns]);

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!sort?.key) return list;
    const col = normalizedColumns.find((c) => c.key === sort.key);
    if (!col) return list;

    const getValue =
      typeof col.sortValue === 'function'
        ? col.sortValue
        : typeof col.accessor === 'function'
          ? col.accessor
          : (r) => (col.accessor ? r?.[col.accessor] : r?.[col.key]);

    list.sort((ra, rb) => {
      const cmp = (col.compare ?? defaultCompare_)(getValue(ra), getValue(rb), ra, rb);
      return sort.dir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [rows, sort, normalizedColumns]);

  const table = (
    <table className={cn('datatable', className)}>
      <thead>
        <tr>
          {normalizedColumns.map((c) => {
            const sortable = c.sortable !== false;
            const isActive = sort?.key === c.key;
            const dir = isActive ? sort.dir : null;

            return (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(sortable && 'is-sortable', isActive && 'is-sorted')}
                onClick={() => {
                  if (!sortable) return;
                  setSort((prev) => {
                    if (prev?.key !== c.key) return { key: c.key, dir: 'asc' };
                    return { key: c.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
                  });
                }}
                role={sortable ? 'button' : undefined}
                tabIndex={sortable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (!sortable) return;
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  setSort((prev) => {
                    if (prev?.key !== c.key) return { key: c.key, dir: 'asc' };
                    return { key: c.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
                  });
                }}
              >
                <span className="datatable-th">
                  <span>{c.header ?? c.key}</span>
                  {sortable ? (
                    <span className="datatable-sort" aria-hidden="true">
                      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}
                    </span>
                  ) : null}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.length === 0 ? (
          <tr>
            <td colSpan={normalizedColumns.length} className="datatable-emptyCell">
              {empty ?? <span className="small">No data</span>}
            </td>
          </tr>
        ) : (
          sortedRows.map((r, idx) => {
            const key = getRowKey ? getRowKey(r) : r?.id ?? r?.key ?? idx;
            const clickable = typeof onRowClick === 'function';
            return (
              <tr
                key={key}
                className={cn(clickable && 'is-clickable')}
                onClick={() => (clickable ? onRowClick(r) : null)}
              >
                {normalizedColumns.map((c) => (
                  <td key={c.key}>
                    {typeof c.cell === 'function'
                      ? c.cell(r)
                      : typeof c.accessor === 'function'
                        ? c.accessor(r)
                        : c.accessor
                          ? r?.[c.accessor]
                          : r?.[c.key]}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  if (!maxHeight) return table;

  return (
    <div className="datatable-scroll" style={{ maxHeight }}>
      {table}
    </div>
  );
}

