import React from 'react';
import { cn } from '../../utils/cn';

export function Tabs({ items, activeKey, onChange, className }) {
  return (
    <div className={cn('tabs', className)}>
      {(items || []).map((t) => (
        <button
          key={t.key}
          className={cn('tab', activeKey === t.key && 'active')}
          onClick={() => onChange?.(t.key)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

