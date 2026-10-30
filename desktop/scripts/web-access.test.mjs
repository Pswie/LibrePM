import test from 'node:test';
import assert from 'node:assert/strict';
import { accessStep, boundedTokenProvider, resolveWebAccess } from '../src/web-access.js';

test('a pending SDK token fails at its own phase without returning an anonymous token', async () => {
  const provider = boundedTokenProvider(() => new Promise(() => {}), new AbortController().signal, 5);
  await assert.rejects(provider(), (error) => error.phase === 'session' && error.code === 'timeout');
});

test('organization failure stops initialization and preserves a classified error', async () => {
  let initialized = false;
  await assert.rejects(resolveWebAccess({ api: { init: () => { initialized = true; } }, organizationId: 'org-fixture', activateOrganization: () => new Promise(() => {}), timeouts: { organization: 5 } }), (error) => error.phase === 'organization' && error.code === 'timeout');
  assert.equal(initialized, false);
});

test('profile deadline aborts the actual fetch signal and ignores a late successful response', async () => {
  let fetchSignal;
  let finish;
  const work = resolveWebAccess({ api: { init: async () => {}, me: ({ signal }) => { fetchSignal = signal; return new Promise((resolve) => { finish = resolve; }); } }, timeouts: { profile: 5 } });
  await assert.rejects(work, (error) => error.phase === 'profile' && error.code === 'timeout');
  assert.equal(fetchSignal.aborted, true);
  finish({ id: 'late-user', roles: ['ADMIN'] });
});

test('identity cancellation aborts profile and cannot resolve the previous user', async () => {
  const controller = new AbortController();
  let fetchSignal;
  const work = resolveWebAccess({ api: { init: async () => {}, me: ({ signal }) => { fetchSignal = signal; controller.abort(); return new Promise(() => {}); } }, signal: controller.signal });
  await assert.rejects(work, (error) => error.code === 'cancelled');
  assert.equal(fetchSignal.aborted, true);
});

test('HTTP denial is surfaced once with its status and without response payloads', async () => {
  await assert.rejects(resolveWebAccess({ api: { init: async () => {}, me: async () => { throw Object.assign(new Error('PRIVATE_RESPONSE_FIXTURE'), { status: 403 }); } } }), (error) => error.phase === 'profile' && error.status === 403 && !error.message.includes('PRIVATE_RESPONSE_FIXTURE'));
});

test('successful profile resolution uses backend identity and validates response shape', async () => {
  const me = { id: 'backend-user', roles: ['ADMIN'] };
  assert.deepEqual(await resolveWebAccess({ api: { init: async () => {}, me: async () => me } }), { user: me, roles: me.roles });
  await assert.rejects(resolveWebAccess({ api: { init: async () => {}, me: async () => ({ roles: [] }) } }), (error) => error.phase === 'profile' && error.code === 'invalid_response');
});

test('an already-cancelled lifecycle never calls the next stage', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(accessStep('profile', () => { called = true; }, { signal: controller.signal, timeoutMs: 10 }), (error) => error.code === 'cancelled');
  assert.equal(called, false);
});
