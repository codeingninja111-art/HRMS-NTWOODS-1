import React from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

const VARIANT_CLASS = {
  primary: 'primary',
  secondary: '',
  success: 'success',
  danger: 'danger',
  ghost: 'ghost',
};

const SIZE_CLASS = {
  sm: 'sm',
  md: '',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}) {
  const isDisabled = disabled || loading;
  const variantClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.secondary;
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;

  const spinnerColor =
    variant === 'primary' || variant === 'danger' || variant === 'success' ? '#fff' : 'var(--primary)';

  return (
    <button
      className={cn('button', variantClass, sizeClass, className)}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Spinner size={14} color={spinnerColor} />
      ) : leftIcon ? (
        <span className="ui-icon">{leftIcon}</span>
      ) : null}
      {children ? <span>{children}</span> : null}
      {rightIcon ? <span className="ui-icon">{rightIcon}</span> : null}
    </button>
  );
}

