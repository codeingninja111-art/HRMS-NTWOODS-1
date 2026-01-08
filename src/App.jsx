import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toasts } from './components/ui/Toasts';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/useAuth';
import { AppLayout } from './components/layout/AppLayout';

// Route-level code splitting (improves LCP by keeping heavy pages out of initial bundle).
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const RequirementsPage = lazy(() => import('./pages/RequirementsPage').then((m) => ({ default: m.RequirementsPage })));
const HrReviewPage = lazy(() => import('./pages/HrReviewPage').then((m) => ({ default: m.HrReviewPage })));
const OwnerPage = lazy(() => import('./pages/OwnerPage').then((m) => ({ default: m.OwnerPage })));
const PrecallPage = lazy(() => import('./pages/PrecallPage').then((m) => ({ default: m.PrecallPage })));
const PreinterviewPage = lazy(() => import('./pages/PreinterviewPage').then((m) => ({ default: m.PreinterviewPage })));
const PublicTestPage = lazy(() => import('./pages/PublicTestPage').then((m) => ({ default: m.PublicTestPage })));
const InpersonTechPage = lazy(() => import('./pages/InpersonTechPage').then((m) => ({ default: m.InpersonTechPage })));
const FinalInterviewPage = lazy(() => import('./pages/FinalInterviewPage').then((m) => ({ default: m.FinalInterviewPage })));
const FinalHoldPage = lazy(() => import('./pages/FinalHoldPage').then((m) => ({ default: m.FinalHoldPage })));
const JoiningPage = lazy(() => import('./pages/JoiningPage').then((m) => ({ default: m.JoiningPage })));
const ProbationPage = lazy(() => import('./pages/ProbationPage').then((m) => ({ default: m.ProbationPage })));
const FailCandidatesPage = lazy(() => import('./pages/FailCandidatesPage').then((m) => ({ default: m.FailCandidatesPage })));
const TestsPage = lazy(() => import('./pages/TestsPage').then((m) => ({ default: m.TestsPage })));
const SlaConfigPage = lazy(() => import('./pages/SlaConfigPage').then((m) => ({ default: m.SlaConfigPage })));
const EmployeeProfilePage = lazy(() => import('./pages/EmployeeProfilePage').then((m) => ({ default: m.EmployeeProfilePage })));
const RejectionLogPage = lazy(() => import('./pages/RejectionLogPage').then((m) => ({ default: m.RejectionLogPage })));
const EmployeeTrainingPage = lazy(() => import('./pages/EmployeeTrainingPage').then((m) => ({ default: m.EmployeeTrainingPage })));

function RouteFallback() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (location.pathname === '/test') {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <div className="card">Loading…</div>
      </AppLayout>
    );
  }

  return (
    <div className="container">
      <div className="card">Loading…</div>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Toasts />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test" element={<PublicTestPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rejections"
            element={
              <ProtectedRoute portalKey="PORTAL_REJECTION_LOG" allowedRoles={['ADMIN', 'EA', 'HR']}>
                <RejectionLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute portalKey="PORTAL_ADMIN" allowedRoles={['ADMIN']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sla"
            element={
              <ProtectedRoute portalKey="PORTAL_ADMIN_SLA" allowedRoles={['ADMIN']}>
                <SlaConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requirements"
            element={
              <ProtectedRoute portalKey="PORTAL_REQUIREMENTS" allowedRoles={['EA', 'ADMIN']}>
                <RequirementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/review"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_REVIEW" allowedRoles={['ADMIN', 'HR']}>
                <HrReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/precall"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_PRECALL" allowedRoles={['ADMIN', 'HR']}>
                <PrecallPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/preinterview"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_PREINTERVIEW" allowedRoles={['ADMIN', 'HR']}>
                <PreinterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/fail-candidates"
            element={
              <ProtectedRoute portalKey="PORTAL_FAIL_CANDIDATES" allowedRoles={['ADMIN', 'HR']}>
                <FailCandidatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/inperson"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_INPERSON" allowedRoles={['ADMIN', 'HR']}>
                <InpersonTechPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/final"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_FINAL" allowedRoles={['ADMIN', 'HR']}>
                <FinalInterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/final-hold"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_FINAL_HOLD" allowedRoles={['ADMIN', 'HR']}>
                <FinalHoldPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/joining"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_JOINING" allowedRoles={['ADMIN', 'HR']}>
                <JoiningPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/probation"
            element={
              <ProtectedRoute portalKey="PORTAL_HR_PROBATION" allowedRoles={['ADMIN', 'HR', 'EA']}>
                <ProbationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/:employeeId"
            element={
              <ProtectedRoute portalKey="PORTAL_EMPLOYEE_PROFILE" allowedRoles={['ADMIN', 'EA', 'HR', 'OWNER']}>
                <EmployeeProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/trainings"
            element={
              <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                <EmployeeTrainingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tests"
            element={
              <ProtectedRoute portalKey="PORTAL_TESTS" allowedRoles={['ADMIN', 'HR', 'EA', 'ACCOUNTS', 'MIS', 'DEO']}>
                <TestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ea/tech"
            element={<Navigate to="/tests" replace />}
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute portalKey="PORTAL_OWNER" allowedRoles={['OWNER', 'ADMIN']}>
                <OwnerPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
