import React from 'react';
import { cn } from '../../utils/cn';

const VARIANT_CLASS = {
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  red: 'red',
  gray: 'gray',
};

export function Badge({ variant = 'gray', className, children, ...props }) {
  const variantClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.gray;
  return (
    <span className={cn('badge', variantClass, className)} {...props}>
      {children}
    </span>
  );
}

