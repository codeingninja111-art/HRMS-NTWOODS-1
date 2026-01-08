import React from 'react';
import { toast } from 'react-hot-toast';

import { cn } from '../../utils/cn';
import { openFile } from '../../utils/files';

export function ViewCvButton({ cvFileId, token, className, label = 'View CV', disabled: disabledProp } = {}) {
  const id = String(cvFileId || '').trim();
  const disabled = disabledProp ?? !id;

  return (
    <button
      type="button"
      className={cn('button', className)}
      disabled={disabled}
      onClick={() => {
        if (!id) return;
        const ok = openFile(id, token);
        if (!ok) toast.error('CV not available');
      }}
    >
      📄 {label}
    </button>
  );
}

