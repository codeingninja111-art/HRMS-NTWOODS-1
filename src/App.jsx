import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './auth/ProtectedRoute';
import { Toasts } from './components/ui/Toasts';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportsPage } from './pages/ReportsPage';

export function App() {
  return (
    <HashRouter>
      <Toasts />
      <Routes>
        <Route path="/" element={<Navigate to="/reports" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OWNER', 'EA', 'HR']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/reports" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}

