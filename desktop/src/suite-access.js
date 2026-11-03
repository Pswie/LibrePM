/** UI affordances only. Every API request is checked by the authority again. */
export const PROJECT_MODULES = Object.freeze(['dashboard', 'inbox', 'charter', 'projects', 'templates', 'team', 'resources', 'connections', 'calendar', 'planner', 'gantt', 'kanban', 'notes', 'time-tracking', 'finance', 'grants', 'stakeholders', 'change-control', 'portfolio', 'guides', 'analytics', 'integrations', 'sync-conflicts', 'settings']);
export function pageModule(id) { return id === 'menu' ? 'projects' : PROJECT_MODULES.includes(id) ? id : null; }
export function canUseModule(user, module, action = 'read') {
  const access = user?.access;
  if (!access) return true; // The local desktop keeps its existing flow.
  return access.status === 'active' && access.applications?.librepm?.enabled === true
    && access.permissions?.includes(`librepm.${module}.${action}`) === true;
}
export function canUsePage(user, id, action = 'read') {
  const module = pageModule(id);
  return !!module && canUseModule(user, module, action);
}
export function needsProjectContext(user) {
  return !user?.access || PROJECT_MODULES.some(module => !['settings', 'guides'].includes(module) && canUseModule(user, module));
}
export function editableAccess(user) {
  const configured = user.configuredApplications ?? user.applications;
  return { version: user.version, status: user.status, applications: Object.fromEntries(
    ['associago', 'librepm', 'bandi'].map(app => [app, { role: configured?.[app]?.role ?? 'none', permissions: configured?.[app]?.role === 'custom' ? [...(configured?.[app]?.permissions ?? [])] : [] }]),
  ) };
}
export function changeModulePermission(application, permission, checked) {
  const permissions = new Set(application.permissions ?? []);
  const prefix = permission.slice(0, permission.lastIndexOf('.') + 1);
  if (checked) { permissions.add(permission); if (permission.endsWith('.write')) permissions.add(prefix + 'read'); }
  else { permissions.delete(permission); if (permission.endsWith('.read')) permissions.delete(prefix + 'write'); }
  return { role: 'custom', permissions: [...permissions].sort() };
}
export function accessOrigin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Indirizzo gestione accessi non valido.');
  return url.origin;
}
