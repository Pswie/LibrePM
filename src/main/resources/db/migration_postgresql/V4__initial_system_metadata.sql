-- Initial system metadata only. No people, passwords, projects or accounting data.
INSERT INTO task_statuses (id,name,description,color,category,created_at,updated_at,sync_status) VALUES
('ts-todo','TODO','Task da fare','#6B7280','TODO',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'),
('ts-in-progress','IN_PROGRESS','Task in corso','#3B82F6','IN_PROGRESS',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'),
('ts-review','REVIEW','Task in revisione','#F59E0B','IN_PROGRESS',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'),
('ts-done','DONE','Task completato','#10B981','DONE',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'),
('ts-blocked','BLOCKED','Task bloccato','#EF4444','BLOCKED',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'),
('ts-cancelled','CANCELLED','Task annullato','#9CA3AF','ARCHIVED',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY');

INSERT INTO task_priorities (id, name, level, color, created_at, updated_at, sync_status)
VALUES
    ('tp-low', 'LOW', 1, '#6B7280', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('tp-medium', 'MEDIUM', 2, '#3B82F6', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('tp-high', 'HIGH', 3, '#F59E0B', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('tp-critical', 'CRITICAL', 4, '#EF4444', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO roles (id, name, description, created_at, updated_at, sync_status)
VALUES
    ('role-owner', 'OWNER', 'Proprietario del progetto con accesso completo', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('role-admin', 'ADMIN', 'Amministratore con accesso quasi completo', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('role-editor', 'EDITOR', 'Può modificare task, note e deliverable', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('role-viewer', 'VIEWER', 'Accesso in sola lettura', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status)
VALUES
    ('pp-owner-1', 'role-owner', 'project:manage', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-2', 'role-owner', 'task:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-3', 'role-owner', 'task:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-4', 'role-owner', 'task:delete', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-5', 'role-owner', 'task:assign', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-6', 'role-owner', 'note:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-7', 'role-owner', 'note:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-8', 'role-owner', 'note:delete', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-9', 'role-owner', 'member:manage', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-owner-10', 'role-owner', 'planning:manage', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status)
VALUES
    ('pp-admin-1', 'role-admin', 'task:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-2', 'role-admin', 'task:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-3', 'role-admin', 'task:delete', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-4', 'role-admin', 'task:assign', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-5', 'role-admin', 'note:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-6', 'role-admin', 'note:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-7', 'role-admin', 'note:delete', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-8', 'role-admin', 'member:manage', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-admin-9', 'role-admin', 'planning:manage', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status)
VALUES
    ('pp-editor-1', 'role-editor', 'task:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-editor-2', 'role-editor', 'task:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-editor-3', 'role-editor', 'note:create', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
    ('pp-editor-4', 'role-editor', 'note:edit', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO roles (id, name, description, created_at, updated_at, sync_status) VALUES
  ('role-member',         'Member',          'Standard operational member',                     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-lead',           'Lead',            'Team/Project lead with extended visibility',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-planner',        'Planner',         'Access to planning, dependencies, Gantt',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-finance-mgr',    'Finance Manager', 'Access to budgets, funds, costs',                 to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-grant-mgr',      'Grant Manager',   'Access to grants, calls, submissions',            to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-sponsor-viewer', 'Sponsor Viewer',  'Read-only access to dashboards and charter',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-auditor',        'Auditor',         'Access to evidence and audit packages (read-only)', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('role-admin',          'Admin',           'Full workspace administration',                   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-m-01', 'role-member', 'TASK_READ',           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-m-02', 'role-member', 'TASK_WRITE',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-m-03', 'role-member', 'NOTE_READ',           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-m-04', 'role-member', 'NOTE_WRITE',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-m-05', 'role-member', 'TIME_ENTRY_READ',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-m-06', 'role-member', 'TIME_ENTRY_WRITE',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-l-01', 'role-lead', 'TASK_READ',             to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-02', 'role-lead', 'TASK_WRITE',            to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-03', 'role-lead', 'NOTE_READ',             to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-04', 'role-lead', 'NOTE_WRITE',            to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-05', 'role-lead', 'TIME_ENTRY_READ',       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-06', 'role-lead', 'TIME_ENTRY_WRITE',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-07', 'role-lead', 'PROJECT_SETTINGS',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-08', 'role-lead', 'MEMBER_MANAGE',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-09', 'role-lead', 'DELIVERABLE_READ',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-l-10', 'role-lead', 'DELIVERABLE_WRITE',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-p-01', 'role-planner', 'TASK_READ',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-02', 'role-planner', 'TASK_WRITE',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-03', 'role-planner', 'GANTT_READ',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-04', 'role-planner', 'GANTT_WRITE',        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-05', 'role-planner', 'DEPENDENCY_READ',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-06', 'role-planner', 'DEPENDENCY_WRITE',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-07', 'role-planner', 'BASELINE_READ',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-p-08', 'role-planner', 'BASELINE_WRITE',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-f-01', 'role-finance-mgr', 'BUDGET_READ',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-f-02', 'role-finance-mgr', 'BUDGET_WRITE',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-f-03', 'role-finance-mgr', 'COST_READ',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-f-04', 'role-finance-mgr', 'COST_WRITE',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-f-05', 'role-finance-mgr', 'TASK_READ',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-f-06', 'role-finance-mgr', 'TIME_ENTRY_READ',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-g-01', 'role-grant-mgr', 'GRANT_READ',       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-g-02', 'role-grant-mgr', 'GRANT_WRITE',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-g-03', 'role-grant-mgr', 'STAKEHOLDER_READ', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-g-04', 'role-grant-mgr', 'STAKEHOLDER_WRITE',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-g-05', 'role-grant-mgr', 'TASK_READ',        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-g-06', 'role-grant-mgr', 'NOTE_READ',        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-sv-01', 'role-sponsor-viewer', 'DASHBOARD_READ', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-sv-02', 'role-sponsor-viewer', 'CHARTER_READ',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-sv-03', 'role-sponsor-viewer', 'DELIVERABLE_READ', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-a-01', 'role-auditor', 'EVIDENCE_READ',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-a-02', 'role-auditor', 'AUDIT_PACKAGE_READ',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-a-03', 'role-auditor', 'AUDIT_PACKAGE_EXPORT',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-a-04', 'role-auditor', 'NOTE_READ',              to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-a-05', 'role-auditor', 'TASK_READ',              to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO permission_policies (id, role_id, permission, created_at, updated_at, sync_status) VALUES
  ('pp-ad-01', 'role-admin', 'TASK_READ',           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-02', 'role-admin', 'TASK_WRITE',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-03', 'role-admin', 'NOTE_READ',           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-04', 'role-admin', 'NOTE_WRITE',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-05', 'role-admin', 'TIME_ENTRY_READ',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-06', 'role-admin', 'TIME_ENTRY_WRITE',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-07', 'role-admin', 'PROJECT_SETTINGS',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-08', 'role-admin', 'MEMBER_MANAGE',       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-09', 'role-admin', 'BUDGET_READ',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-10', 'role-admin', 'BUDGET_WRITE',        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-11', 'role-admin', 'COST_READ',           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-12', 'role-admin', 'COST_WRITE',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-13', 'role-admin', 'GRANT_READ',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-14', 'role-admin', 'GRANT_WRITE',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-15', 'role-admin', 'STAKEHOLDER_READ',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-16', 'role-admin', 'STAKEHOLDER_WRITE',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-17', 'role-admin', 'GANTT_READ',          to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-18', 'role-admin', 'GANTT_WRITE',         to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-19', 'role-admin', 'DEPENDENCY_READ',     to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-20', 'role-admin', 'DEPENDENCY_WRITE',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-21', 'role-admin', 'BASELINE_READ',       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-22', 'role-admin', 'BASELINE_WRITE',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-23', 'role-admin', 'DELIVERABLE_READ',    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-24', 'role-admin', 'DELIVERABLE_WRITE',   to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-25', 'role-admin', 'EVIDENCE_READ',       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-26', 'role-admin', 'AUDIT_PACKAGE_READ',  to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-27', 'role-admin', 'AUDIT_PACKAGE_EXPORT',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-28', 'role-admin', 'DASHBOARD_READ',      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY'),
  ('pp-ad-29', 'role-admin', 'CHARTER_READ',        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), 'LOCAL_ONLY') ON CONFLICT DO NOTHING;

INSERT INTO workspace_profiles (id, name, description, modules_json, is_system) VALUES
  ('wp-personal', 'Personal', 'Tasks, notes, lightweight planning', '{"planning":false,"finance":false,"grants":false,"portfolio":false,"branches":false}', TRUE),
  ('wp-team', 'Team Operations', 'Collaboration, boards, timeline, workload', '{"planning":true,"finance":false,"grants":false,"portfolio":false,"branches":false}', TRUE),
  ('wp-pm', 'PM / PMO Light', 'Baselines, forecasts, resource planning', '{"planning":true,"finance":true,"grants":false,"portfolio":false,"branches":true}', TRUE),
  ('wp-nonprofit', 'Nonprofit & Donations', 'Funds, donors, reporting', '{"planning":true,"finance":true,"grants":true,"portfolio":false,"branches":false}', TRUE),
  ('wp-grant', 'Grant & Calls', 'Grants, eligibility, submissions', '{"planning":true,"finance":true,"grants":true,"portfolio":false,"branches":true}', TRUE),
  ('wp-agency', 'Agency / Consultancy', 'Budget per deliverable, stakeholders', '{"planning":true,"finance":true,"grants":false,"portfolio":false,"branches":true}', TRUE),
  ('wp-rd', 'R&D Consortium', 'Partners, work packages, co-funding', '{"planning":true,"finance":true,"grants":true,"portfolio":true,"branches":true}', TRUE) ON CONFLICT DO NOTHING;

INSERT INTO work_calendars (id,name,description,scope,created_at,updated_at,sync_status)
VALUES ('cal-standard','Standard','Calendario lavorativo standard Mon-Ven 9-17','GLOBAL',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY');
INSERT INTO work_day_rules (id,calendar_id,day_of_week,is_working_day,start_time,end_time,created_at,updated_at,sync_status)
SELECT 'day-standard-'||lower(day),'cal-standard',day,working,start_t,end_t,to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),'LOCAL_ONLY'
FROM (VALUES
('MONDAY',true,'09:00','17:00'),('TUESDAY',true,'09:00','17:00'),('WEDNESDAY',true,'09:00','17:00'),
('THURSDAY',true,'09:00','17:00'),('FRIDAY',true,'09:00','17:00'),('SATURDAY',false,NULL,NULL),('SUNDAY',false,NULL,NULL)
) AS days(day,working,start_t,end_t);
