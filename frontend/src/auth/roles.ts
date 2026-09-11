/**
 * Staff roles as carried in the authenticated session's `app_role` claim
 * (design 4.1). The role that drives routing comes from the session, never from
 * client state — a tampered local value changes what is drawn, not what the API
 * or database permits (design 9).
 */
export type AppRole = 'super_admin' | 'admin' | 'doctor' | 'receptionist';

/** Landing route for each role after login. */
export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: '/admin',
  admin: '/clinic',
  doctor: '/schedule',
  receptionist: '/desk',
};
