// Jest mock for services/analytics — keeps tests free of Sentry's ESM
// import pipeline. Each exported function is a noop stub so callers
// (e.g. services/supabase.ts) can invoke them without Sentry/PostHog
// being initialised in the test environment.

export const initAnalytics = () => {};
export const track = (_event: string, _properties?: Record<string, any>) => {};
export const trackScreen = (_screenName: string) => {};
export const identifyUser = (
  _userId: string,
  _traits?: Record<string, any>
) => {};
export const resetIdentity = () => {};
export const addBreadcrumb = (
  _category: string,
  _message: string,
  _data?: Record<string, any>
) => {};
export const captureError = (_error: Error, _context?: Record<string, any>) => {};
export const captureWarning = (
  _message: string,
  _context?: Record<string, any>
) => {};
export const ErrorBoundary = ({ children }: { children: any }) => children;
export const wrap = <T>(component: T): T => component;
export const flush = async () => true;
