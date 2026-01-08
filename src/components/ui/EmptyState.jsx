import React from 'react';
import { cn } from '../../utils/cn';

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('empty-state', className)}>
      {icon ? (
        <div className="empty-state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {title ? <div className="empty-state-title">{title}</div> : null}
      {description ? <div className="empty-state-description">{description}</div> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

