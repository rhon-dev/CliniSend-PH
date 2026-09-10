import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import type { AppRole } from './auth/roles';

/**
 * Placeholder shell views. Foundation delivers the routing skeleton and the
 * public auth/registration entry points; the dashboards are shells until the
 * Patients & Appointments phase onward (design 9).
 */
function Placeholder({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>This view is a Foundation-phase placeholder.</p>
    </main>
  );
}

/**
 * Guards a route group by role. In the scaffold, `currentRole` is always null
 * (no session wiring yet), so protected groups redirect to /login. Real session
 * resolution — reading `app_role` from the authenticated Supabase session — is
 * added in the Staff Authentication phase. The role always comes from the
 * session, never from client state (design 9).
 */
function RequireRole({
  allow,
  currentRole,
  children,
}: {
  allow: AppRole[];
  currentRole: AppRole | null;
  children: React.ReactNode;
}) {
  if (currentRole === null) return <Navigate to="/login" replace />;
  if (!allow.includes(currentRole)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  // Session wiring arrives in a later phase; the scaffold has no authenticated role.
  const currentRole: AppRole | null = null;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Placeholder title="Staff Login" />} />
        <Route path="/reset-password" element={<Placeholder title="Reset Password" />} />
        <Route path="/register-clinic" element={<Placeholder title="Register a Clinic" />} />
        <Route path="/invitations/:token" element={<Placeholder title="Set Your Credentials" />} />

        {/* Super Admin */}
        <Route
          path="/admin/*"
          element={
            <RequireRole allow={['super_admin']} currentRole={currentRole}>
              <Placeholder title="Super Admin" />
            </RequireRole>
          }
        />

        {/* Clinic Admin */}
        <Route
          path="/clinic/*"
          element={
            <RequireRole allow={['admin']} currentRole={currentRole}>
              <Placeholder title="Clinic Admin" />
            </RequireRole>
          }
        />

        {/* Doctor */}
        <Route
          path="/schedule/*"
          element={
            <RequireRole allow={['doctor']} currentRole={currentRole}>
              <Placeholder title="Doctor Schedule" />
            </RequireRole>
          }
        />

        {/* Receptionist */}
        <Route
          path="/desk/*"
          element={
            <RequireRole allow={['receptionist']} currentRole={currentRole}>
              <Placeholder title="Front Desk" />
            </RequireRole>
          }
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Placeholder title="Not Found" />} />
      </Routes>
    </BrowserRouter>
  );
}
