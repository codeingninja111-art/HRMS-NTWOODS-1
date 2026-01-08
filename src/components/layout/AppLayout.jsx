import React from 'react';
import { AppShell } from './AppShell';

export function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
