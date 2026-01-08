import React from 'react';
import { cn } from '../../utils/cn';

export function IconButton({ label, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn('icon-button', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

