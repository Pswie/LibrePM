const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An explicit deep link must either resolve to its own authorized project or fail visibly. */
export async function initialSuiteProject({ search, projects, loadContext, loadSelection, loadProject }) {
    const params = new URLSearchParams(search);
    const explicit = params.has('suiteProject');
    let id = params.get('suiteProject');
    if (explicit && !UUID.test(id || '')) throw new Error('Il collegamento al progetto non è valido.');
    if (!explicit) {
        try { id = (await loadSelection())?.suiteProjectId; }
        catch (error) {
            // Optional integration must not prevent normal local work when disabled/offline.
            if (error.status !== 503 && error.status !== 0) throw error;
            id = null;
        }
    }
    if (!id) return projects[0] || null;
    // The saved selection endpoint already checks registry membership. A project
    // returned by the normal authorized list can still open when a peer or its
    // projection is temporarily unavailable, so the user can correct the plan.
    if (!explicit) {
        const local = projects.find(project => project.id === id);
        if (local) return local;
    }
    const context = await loadContext(id);
    if (context?.suiteProjectId !== id) throw new Error('Il progetto richiesto non è disponibile.');
    return projects.find(project => project.id === id) || await loadProject(id);
}

export function safeSuiteLink(value) {
    if (!value) return null;
    try {
        const url = new URL(value);
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        return !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ? url.href : null;
    } catch { return null; }
}
