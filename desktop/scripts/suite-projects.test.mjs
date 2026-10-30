import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSuiteProject, safeSuiteLink } from '../src/utils/suiteProjects.js';

const first = { id: '11111111-1111-1111-1111-111111111111', name: 'Primo' };
const requested = { id: '22222222-2222-2222-2222-222222222222', name: 'Richiesto' };
const base = { projects: [first, requested], loadSelection: async () => ({ suiteProjectId: null }),
    loadContext: async id => ({ suiteProjectId: id }), loadProject: async () => { throw new Error('unexpected'); } };
test('deep link resolves the requested project after authorization, even if it is not first', async () => {
    assert.equal(await initialSuiteProject({ ...base, search: `?suiteProject=${requested.id}` }), requested);
});
test('invalid or forbidden explicit links never fall back to an unrelated project', async () => {
    await assert.rejects(initialSuiteProject({ ...base, search: '?suiteProject=broken' }), /non è valido/);
    await assert.rejects(initialSuiteProject({ ...base, search: `?suiteProject=${requested.id}`, loadContext: async () => { throw new Error('Forbidden'); } }), /Forbidden/);
});
test('saved selection is resolved on reload; disabled integration keeps local work usable', async () => {
    assert.equal(await initialSuiteProject({ ...base, search: '', loadSelection: async () => ({ suiteProjectId: requested.id }) }), requested);
    assert.equal(await initialSuiteProject({ ...base, search: '', loadSelection: async () => { throw Object.assign(new Error('Disabled'), { status: 503 }); } }), first);
});
test('outgoing links reject script URLs, userinfo and insecure remote HTTP', () => {
    assert.equal(safeSuiteLink('javascript:alert(1)'), null);
    assert.equal(safeSuiteLink('https://secret@example.org/'), null);
    assert.equal(safeSuiteLink('http://example.org/?suiteProject=test'), null);
    assert.equal(safeSuiteLink('https://example.org/?suiteProject=test'), 'https://example.org/?suiteProject=test');
    assert.equal(safeSuiteLink('http://127.0.0.1:8000/suite/projects/test'), 'http://127.0.0.1:8000/suite/projects/test');
});
test('a valid saved selection remains usable locally if its projection cannot be read', async () => {
    const result = await initialSuiteProject({ ...base, search: '', loadSelection: async () => ({ suiteProjectId: requested.id }),
        loadContext: async () => { throw Object.assign(new Error('Budget requires correction'), { status: 409 }); } });
    assert.equal(result, requested);
});
