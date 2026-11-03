import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseModule, canUsePage, changeModulePermission, editableAccess, accessOrigin, needsProjectContext } from '../src/suite-access.js';

function user(permissions = [], status = 'active') { return { access: { status, owner: false, canManageAccess: false, applications: { librepm: { enabled: status === 'active' } }, permissions } }; }
test('registered pending and suspended users cannot navigate despite previous permissions', () => {
  for (const state of ['pending', 'suspended']) assert.equal(canUsePage(user(['librepm.projects.read'], state), 'menu'), false);
  assert.equal(canUsePage(user(['librepm.projects.read']), 'menu'), true);
  assert.equal(canUsePage(user(['librepm.projects.read']), 'finance'), false);
  assert.equal(canUsePage(user(['librepm.projects.read']), 'unknown-page'), false);
});
test('read-only capability does not enable creation commands', () => {
  assert.equal(canUsePage(user(['librepm.projects.read']), 'menu', 'write'), false);
  assert.equal(canUseModule(user(['librepm.settings.read']), 'settings', 'write'), false);
  assert.equal(canUsePage({ id: 'local-desktop-user' }, 'menu', 'write'), true);
});
test('custom view permissions can request minimal project context without opening the Projects module', () => {
  const scoped = user(['librepm.kanban.read']);
  assert.equal(needsProjectContext(scoped), true);
  assert.equal(canUsePage(scoped, 'menu'), false);
  assert.equal(needsProjectContext(user(['librepm.guides.read'])), false);
});
test('changing to custom permissions keeps write and read consistent', () => {
  const write = changeModulePermission({ role: 'viewer', permissions: [] }, 'librepm.finance.write', true);
  assert.deepEqual(write, { role: 'custom', permissions: ['librepm.finance.read', 'librepm.finance.write'] });
  assert.deepEqual(changeModulePermission(write, 'librepm.finance.read', false).permissions, []);
});
test('editing a suspended user preserves configured grants rather than effective empty grants', () => {
  const existing = { version: 3, status: 'suspended', configuredApplications: { librepm: { role: 'custom', permissions: ['librepm.projects.read'] } }, applications: { librepm: { role: 'none', permissions: [] } } };
  const draft = editableAccess(existing);
  assert.equal(draft.version, 3);
  assert.deepEqual(draft.applications.librepm, { role: 'custom', permissions: ['librepm.projects.read'] });
  draft.applications.librepm.permissions.push('librepm.notes.read');
  assert.equal(existing.configuredApplications.librepm.permissions.length, 1);
});
test('preset roles send no redundant custom permission array', () => {
  for (const role of ['viewer', 'editor', 'manager']) {
    const draft = editableAccess({ version: 2, status: 'active', configuredApplications: { librepm: { role, permissions: ['librepm.projects.read'] } } });
    assert.deepEqual(draft.applications.librepm, { role, permissions: [] });
  }
});
test('authority URL is an exact secure origin with no credential, path or query', () => {
  assert.equal(accessOrigin('https://authority.example'), 'https://authority.example');
  assert.equal(accessOrigin('http://127.0.0.1:11223'), 'http://127.0.0.1:11223');
  for (const url of ['http://authority.example', 'https://name:password@authority.example', 'https://authority.example/other', 'https://authority.example?token=value']) assert.throws(() => accessOrigin(url));
});
