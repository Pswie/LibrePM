import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// The client initializes at import time, so install the desktop bridge before
// importing it, just as Electron does before loading its renderer.
const startupWindow = globalThis.window;
globalThis.window = { librepm: { getBackendPort: async () => 8080 } };
const { librepm } = await import('../src/api/librepm.js');
await librepm.init();
globalThis.window = startupWindow;

let originalFetch;
let originalDocument;
let originalWindow;
let originalCreateObjectURL;
let originalRevokeObjectURL;
let clicked;
let removed;
let anchor;

beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    clicked = 0;
    removed = 0;
    anchor = { click() { clicked += 1; }, remove() { removed += 1; } };
    globalThis.window = { librepm: { getBackendPort: async () => 8080 } };
    globalThis.document = {
        createElement: () => anchor,
        body: { appendChild() {} },
    };
    URL.createObjectURL = () => 'blob:test-download';
    URL.revokeObjectURL = () => {};
    librepm.setCurrentUser('user-1');
    librepm.setTokenProvider(async () => 'rotating-session-token');
    await librepm.init();
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    librepm.setTokenProvider(null);
});

test('asset downloads attach the current JWT and preserve the filename', async () => {
    let request;
    globalThis.fetch = async (url, config) => {
        request = { url, config };
        return new Response('document bytes', { headers: { 'Content-Type': 'application/pdf' } });
    };
    await librepm.assetsDownload('asset-1', 'domanda.pdf');
    assert.equal(request.url, 'http://localhost:8080/api/users/user-1/assets/asset-1/download');
    assert.equal(request.config.headers.Authorization, 'Bearer rotating-session-token');
    assert.equal(anchor.download, 'domanda.pdf');
    assert.equal(anchor.href, 'blob:test-download');
    assert.equal(clicked, 1);
    assert.equal(removed, 1);
});

test('a rejected download does not create an empty or misleading file', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Access denied' }), { status: 403 });
    await assert.rejects(librepm.assetsDownload('asset-1'), /Access denied/);
    assert.equal(clicked, 0);
});

test('project CSV export uses the scoped endpoint and the actual CSV payload', async () => {
    let request;
    const csv = 'id,title\n1,Bando\n';
    globalThis.fetch = async (url, config) => {
        request = { url, config };
        return new Response(JSON.stringify({ status: 'COMPLETED', resultPayload: csv }));
    };
    const blob = await librepm.exportProject('project-1', 'csv');
    assert.equal(request.url, 'http://localhost:8080/api/users/user-1/projects/project-1/export/csv');
    assert.equal(request.config.method, 'POST');
    assert.equal(request.config.headers.Authorization, 'Bearer rotating-session-token');
    assert.equal(blob.type, 'text/csv;charset=utf-8');
    assert.equal(await blob.text(), csv);
});

test('project JSON export returns JSON instead of a renamed SQLite backup', async () => {
    const json = JSON.stringify({ projectId: 'project-1', tasks: [] });
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 'COMPLETED', resultPayload: json }));
    const blob = await librepm.exportProject('project-1', 'json');
    assert.equal(blob.type, 'application/json');
    assert.deepEqual(JSON.parse(await blob.text()), { projectId: 'project-1', tasks: [] });
});

test('a failed export job is surfaced as an error', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 'FAILED', errorMessage: 'Export unavailable' }));
    await assert.rejects(librepm.exportProject('project-1'), /Export unavailable/);
});
