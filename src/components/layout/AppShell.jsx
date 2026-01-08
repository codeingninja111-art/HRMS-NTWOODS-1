import React, { memo, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_COLLAPSED_KEY = 'ntw_hrms_sidebar_collapsed_v1';

function loadCollapsed_() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed_(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore
  }
}

const ShellContent = memo(function ShellContent({ children }) {
  return children;
});

export function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed_);

  useEffect(() => {
    saveCollapsed_(collapsed);
  }, [collapsed]);

  return (
    <div className={cn('app-shell', collapsed && 'is-collapsed')}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((s) => !s)} />
      <div className="app-main">
        <Topbar onToggleCollapsed={() => setCollapsed((s) => !s)} />
        <main className="app-content">
          <div className="container">
            <ShellContent>{children}</ShellContent>
          </div>
        </main>
      </div>
    </div>
  );
}
