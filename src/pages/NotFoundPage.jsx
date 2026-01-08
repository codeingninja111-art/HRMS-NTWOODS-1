import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';

export function NotFoundPage() {
  return (
    <AppLayout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Not found</h2>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    </AppLayout>
  );
}
