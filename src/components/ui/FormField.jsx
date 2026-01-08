import React from 'react';
import { cn } from '../../utils/cn';

export function FormField({ id, label, required, helper, error, className, children }) {
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-label" htmlFor={id}>
          {label} {required ? <span className="form-required">*</span> : null}
        </label>
      ) : null}
      <div className={cn('form-control', error && 'is-error')}>{children}</div>
      {error ? <div className="form-error">{error}</div> : helper ? <div className="form-helper">{helper}</div> : null}
    </div>
  );
}

