import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

const SIZE_PX = {
  sm: 360,
  md: 520,
  lg: 720,
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const width = SIZE_PX[size] ?? SIZE_PX.md;

  return createPortal(
    <div className="drawer-overlay" role="presentation" onMouseDown={() => onClose?.()}>
      <aside
        className={cn('drawer', className)}
        style={{ width: `min(${Number(width)}px, 96vw)` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="drawer-header">
            <div style={{ minWidth: 0 }}>
              {title ? (
                <div id={titleId} className="drawer-title">
                  {title}
                </div>
              ) : null}
              {description ? (
                <div id={descId} className="drawer-description">
                  {description}
                </div>
              ) : null}
            </div>
            <button className="button sm" type="button" onClick={() => onClose?.()}>
              Close
            </button>
          </div>
        )}

        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </aside>
    </div>,
    document.body
  );
}

