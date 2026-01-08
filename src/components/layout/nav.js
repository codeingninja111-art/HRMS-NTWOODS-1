export function getNavSections() {
  return [
    {
      key: 'core',
      title: 'Core',
      items: [
        { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
        { key: 'tests', label: 'Tests', to: '/tests', portalKey: 'PORTAL_TESTS', roles: ['ADMIN', 'HR', 'EA', 'ACCOUNTS', 'MIS', 'DEO'], preload: () => import('../../pages/TestsPage.jsx') },
      ],
    },
    {
      key: 'ea',
      title: 'EA',
      items: [
        { key: 'requirements', label: 'Requirements', to: '/requirements', portalKey: 'PORTAL_REQUIREMENTS', roles: ['EA', 'ADMIN'], preload: () => import('../../pages/RequirementsPage.jsx') },
      ],
    },
    {
      key: 'hr',
      title: 'HR Workflow',
      items: [
        { key: 'hrReview', label: 'Requirement Review', to: '/hr/review', portalKey: 'PORTAL_HR_REVIEW', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/HrReviewPage.jsx') },
        { key: 'precall', label: 'Precall', to: '/hr/precall', portalKey: 'PORTAL_HR_PRECALL', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/PrecallPage.jsx') },
        { key: 'preinterview', label: 'Pre-interview', to: '/hr/preinterview', portalKey: 'PORTAL_HR_PREINTERVIEW', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/PreinterviewPage.jsx') },
        { key: 'failCandidates', label: 'Fail Candidates', to: '/hr/fail-candidates', portalKey: 'PORTAL_FAIL_CANDIDATES', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/FailCandidatesPage.jsx') },
        { key: 'inperson', label: 'In-person', to: '/hr/inperson', portalKey: 'PORTAL_HR_INPERSON', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/InpersonTechPage.jsx') },
        { key: 'final', label: 'Final Interview', to: '/hr/final', portalKey: 'PORTAL_HR_FINAL', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/FinalInterviewPage.jsx') },
        { key: 'finalHold', label: 'Final Hold', to: '/hr/final-hold', portalKey: 'PORTAL_HR_FINAL_HOLD', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/FinalHoldPage.jsx') },
        { key: 'joining', label: 'Joining', to: '/hr/joining', portalKey: 'PORTAL_HR_JOINING', roles: ['HR', 'ADMIN'], preload: () => import('../../pages/JoiningPage.jsx') },
        { key: 'probation', label: 'Probation', to: '/hr/probation', portalKey: 'PORTAL_HR_PROBATION', roles: ['HR', 'EA', 'ADMIN'], preload: () => import('../../pages/ProbationPage.jsx') },
      ],
    },
    {
      key: 'owner',
      title: 'Owner',
      items: [{ key: 'owner', label: 'Approvals', to: '/owner', portalKey: 'PORTAL_OWNER', roles: ['OWNER', 'ADMIN'], preload: () => import('../../pages/OwnerPage.jsx') }],
    },
    {
      key: 'logs',
      title: 'Logs',
      items: [{ key: 'rejections', label: 'Rejection Log', to: '/rejections', portalKey: 'PORTAL_REJECTION_LOG', roles: ['EA', 'HR', 'ADMIN'], preload: () => import('../../pages/RejectionLogPage.jsx') }],
    },
    {
      key: 'employee',
      title: 'Employee',
      items: [{ key: 'trainings', label: 'Trainings', to: '/employee/trainings', roles: ['EMPLOYEE'], preload: () => import('../../pages/EmployeeTrainingPage.jsx') }],
    },
    {
      key: 'admin',
      title: 'Admin',
      items: [
        { key: 'admin', label: 'Admin', to: '/admin', portalKey: 'PORTAL_ADMIN', roles: ['ADMIN'], preload: () => import('../../pages/AdminPage.jsx') },
        { key: 'sla', label: 'SLA Config', to: '/admin/sla', portalKey: 'PORTAL_ADMIN_SLA', roles: ['ADMIN'], preload: () => import('../../pages/SlaConfigPage.jsx') },
      ],
    },
  ];
}
