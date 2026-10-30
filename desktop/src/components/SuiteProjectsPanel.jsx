import React, { useCallback, useEffect, useState } from 'react';
import { librepm } from '../api/librepm.js';
import { safeSuiteLink } from '../utils/suiteProjects.js';

const labels = { associago: 'AssociaGo · soci e volontari', bandi: 'Bandi · candidature', librepm: 'LibrePM · piano di progetto' };
const statusLabels = { disabled: 'Non configurato', unlinked: 'Da collegare', pending: 'In corso', synced: 'Allineato', error: 'Da riprovare' };

export default function SuiteProjectsPanel({ shell }) {
    const id = shell.currentProject?.id;
    const [catalog, setCatalog] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const current = catalog.find(project => project.suiteProjectId === id);
    const load = useCallback(async () => {
        setError('');
        try { setCatalog(await librepm.suiteProjects()); }
        catch (e) { setError(e.message); setCatalog([]); }
    }, []);
    useEffect(() => { load(); }, [load, id]);
    const run = async (operation) => {
        setBusy(true); setError(''); setNotice('');
        try { await operation(); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };
    const register = () => run(async () => {
        await librepm.suiteRegister(id);
        await librepm.suiteSelect(id);
        await load();
        setNotice('Progetto registrato. Premi Allinea per aggiornare le altre applicazioni.');
    });
    const sync = () => run(async () => {
        const result = await librepm.suiteSync(id);
        setCatalog(previous => previous.map(project => project.suiteProjectId === id ? result : project));
        const incomplete = result.sync.some(peer => peer.status !== 'synced');
        setNotice(incomplete ? 'Allineamento incompleto: controlla lo stato delle applicazioni qui sotto.' : 'Le applicazioni collegate sono allineate.');
    });
    const choose = (selectedId) => {
        if (!selectedId) return;
        run(async () => {
            const project = await librepm.projectsGet(selectedId);
            await librepm.suiteSelect(selectedId);
            shell.setCurrentProject(project);
            const url = new URL(window.location.href);
            url.searchParams.set('suiteProject', selectedId);
            window.history.replaceState(null, '', url);
        });
    };
    return <section className="card shadow-sm mb-4" aria-labelledby="suite-title">
        <div className="card-header"><h5 id="suite-title" className="mb-0">Progetti collegati</h5></div>
        <div className="card-body">
            <p className="text-muted">Un progetto comune, tre applicazioni: piano in LibrePM, persone e rendiconto in AssociaGo, candidatura in Bandi.</p>
            {error && <div className="alert alert-warning" role="alert">{error}<button disabled={busy} onClick={load} className="btn btn-sm btn-outline-secondary ms-2">Riprova</button></div>}
            {notice && <p className="alert alert-info" role="status">{notice}</p>}
            {catalog.length > 0 && <div className="mb-3">
                <label htmlFor="suite-project-choice" className="form-label">Scegli un progetto comune</label>
                <select id="suite-project-choice" disabled={busy} className="form-select" value={current?.suiteProjectId || ''} onChange={e => choose(e.target.value)}>
                    <option value="">Seleziona progetto</option>
                    {catalog.map(project => <option key={project.suiteProjectId} value={project.suiteProjectId}>{project.title}</option>)}
                </select>
            </div>}
            <p className="mb-2">Progetto corrente: <strong>{shell.currentProject?.name || 'Nessun progetto selezionato'}</strong></p>
            <div className="d-flex flex-wrap gap-2 mb-3">
                {current ? <button disabled={busy} className="btn btn-primary" onClick={sync}>{busy ? 'Attendi…' : 'Allinea applicazioni'}</button>
                    : <button disabled={busy || !id || !!error} className="btn btn-primary" onClick={register}>Condividi questo progetto</button>}
                {current && ['associago', 'bandi'].map(system => {
                    const href = safeSuiteLink(current.links?.[system]);
                    return href && <a key={system} className="btn btn-outline-primary" href={href} target="_blank" rel="noopener noreferrer">Apri in {system === 'bandi' ? 'Bandi' : 'AssociaGo'}</a>;
                })}
            </div>
            {current && <>
                <ul className="list-group mb-3">{current.sync.map(peer => <li key={peer.system} className="list-group-item">
                    <div className="d-flex flex-wrap justify-content-between gap-2"><strong>{labels[peer.system]}</strong><span>{statusLabels[peer.status] || peer.status}</span></div>
                    {peer.lastSuccessAt && <div className="small text-muted">Ultimo allineamento: {new Date(peer.lastSuccessAt).toLocaleString('it-IT')}</div>}
                    {peer.errorMessage && <div className="small text-danger">{peer.errorMessage}</div>}
                </li>)}</ul>
                {current.financial && <p className="mb-2">Rendiconto AssociaGo: entrate {current.financial.income} {current.financial.currency}, uscite {current.financial.expense}, saldo {current.financial.balance}. <span className="text-muted">Sola lettura.</span></p>}
                {current.workforce && <p className="mb-2">Persone assegnate: {current.workforce.assignedCount}. Ore completate: {current.workforce.completedHours}.</p>}
                {current.preparation && <p className="mb-0">Candidatura Bandi: {current.preparation.title} · {current.preparation.status} · revisione {current.preparation.version}. <span className="text-muted">Sola lettura.</span></p>}
            </>}
        </div>
    </section>;
}
