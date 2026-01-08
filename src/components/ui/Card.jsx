import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn('card-header', className)}>
      <div style={{ minWidth: 0 }}>
        {title ? <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{title}</div> : null}
        {subtitle ? <div className="small">{subtitle}</div> : null}
      </div>
      {actions ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

