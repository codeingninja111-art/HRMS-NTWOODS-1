import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
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

  return createPortal(
    <div className="modal-overlay" role="presentation" onMouseDown={() => onClose?.()}>
      <div
        className={cn('modal', className)}
        style={{ width: `min(${Number(width)}px, 96vw)` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              {title ? (
                <div id={titleId} className="modal-title">
                  {title}
                </div>
              ) : null}
              {description ? (
                <div id={descId} className="modal-description">
                  {description}
                </div>
              ) : null}
            </div>
            <button className="button sm" type="button" onClick={() => onClose?.()}>
              Close
            </button>
          </div>
        )}

        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

