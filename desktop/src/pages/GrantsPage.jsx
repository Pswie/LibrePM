import { useState, useEffect, useRef } from 'react';
import { librepm } from '@api/librepm.js';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useModal } from '../hooks/useModal.js';
import ProjectRequired from '../components/ProjectRequired.jsx';

const CALL_STATUSES = ['IDENTIFIED', 'EVALUATING', 'PREPARING', 'SUBMITTED', 'AWARDED', 'REJECTED', 'CLOSED'];
const OBL_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const RP_STATUSES = ['UPCOMING', 'OPEN', 'SUBMITTED', 'ACCEPTED'];
const OBL_TYPES = ['CONTRACTUAL', 'GRANT', 'REGULATORY', 'REPORTING'];
const REQ_TYPES = ['DOCUMENT', 'ELIGIBILITY', 'BUDGET', 'PARTNER', 'TECHNICAL'];

// A project owns every selection and draft in this page. Remounting also keeps
// responses from a previous project from replacing the new project's data.
export default function GrantsPage({ shell }) {
    return <ProjectGrants key={shell?.currentProject?.id || 'none'} shell={shell} />;
}

function ProjectGrants({ shell }) {
    const { t } = useTranslation();
    const modal = useModal();
    const projectId = shell?.currentProject?.id;
    const [tab, setTab] = useState('calls');
    const [calls, setCalls] = useState([]);
    const [selectedCallId, setSelectedCallId] = useState(null);
    const [requirementsData, setRequirementsData] = useState({ callId: null, items: [] });
    const [requirementsLoading, setRequirementsLoading] = useState(false);
    const [requirementsError, setRequirementsError] = useState('');
    const [obligations, setObligations] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState(false);
    const currentCall = useRef(selectedCallId);
    currentCall.current = selectedCallId;
    const selectedCall = calls.find(c => c.id === selectedCallId);
    const requirements = requirementsData.callId === selectedCallId ? requirementsData.items : [];

    useEffect(() => {
        shell?.setTitle?.(t('Grants'));
        shell?.setHeaderActions?.(null);
        shell?.setRightPanel?.(null);
    }, [shell, t]);

    useEffect(() => {
        if (!projectId) { setLoading(false); return undefined; }
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        Promise.all([
            librepm.grantCallsList(projectId),
            librepm.grantObligationsList(projectId),
            librepm.grantReportingPeriodsList(projectId),
        ]).then(([newCalls, newObligations, newPeriods]) => {
            if (cancelled) return;
            setCalls(newCalls || []);
            setObligations(newObligations || []);
            setPeriods(newPeriods || []);
            setSelectedCallId(previous => newCalls?.some(c => c.id === previous) ? previous : newCalls?.[0]?.id || null);
        }).catch(error => {
            if (!cancelled) setLoadError(error.message);
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId, reload]);

    useEffect(() => {
        if (!selectedCallId) return undefined;
        let cancelled = false;
        setRequirementsLoading(true);
        setRequirementsError('');
        librepm.grantRequirementsList(projectId, selectedCallId).then(items => {
            if (!cancelled) setRequirementsData({ callId: selectedCallId, items: items || [] });
        }).catch(error => {
            if (!cancelled) setRequirementsError(error.message);
        }).finally(() => { if (!cancelled) setRequirementsLoading(false); });
        return () => { cancelled = true; };
    }, [projectId, selectedCallId, reload]);

    // A failed write leaves the editable draft intact and reports the error.
    const write = async (operation) => {
        setBusy(true);
        try {
            await operation();
            return true;
        } catch (error) {
            toast.error(`${t('Error')}: ${error.message}`);
            return false;
        } finally { setBusy(false); }
    };

    const remove = async (operation) => {
        if (!await modal.confirm({ title: t('Delete this item?') })) return false;
        return write(operation);
    };

    const updateCall = (data) => write(async () => {
        const updated = await librepm.grantCallUpdate(projectId, selectedCallId, data);
        setCalls(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success(t('Saved successfully'));
    });

    const updateRequirement = (requirementId, data) => {
        const callId = selectedCallId;
        return write(async () => {
            const updated = await librepm.grantRequirementUpdate(projectId, callId, requirementId, data);
            if (currentCall.current === callId) setRequirementsData(prev => ({
                callId, items: prev.items.map(r => r.id === requirementId ? updated : r),
            }));
            toast.success(t('Saved successfully'));
        });
    };

    if (!projectId) return <ProjectRequired shell={shell} />;
    if (loading) return <div className="p-4" role="status">{t('Loading...')}</div>;
    if (loadError) return <div className="p-4"><div className="alert alert-danger" role="alert">{loadError}</div><button className="btn btn-outline-primary" onClick={() => setReload(v => v + 1)}>{t('Retry')}</button></div>;

    return <div className="container-fluid p-4">
        <ul className="nav nav-tabs mb-4">
            {['calls', 'obligations', 'reporting'].map(key => <li className="nav-item" key={key}>
                <button className={`nav-link ${tab === key ? 'active' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
                    {t(key === 'calls' ? 'Calls' : key === 'obligations' ? 'Obligations' : 'Reporting')}
                </button>
            </li>)}
        </ul>

        {tab === 'calls' && <div className="row g-4">
            <div className="col-md-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h6 className="mb-0">{t('Grant Calls')}</h6>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => write(async () => {
                        const created = await librepm.grantCallCreate(projectId, { title: t('New call') });
                        setCalls(prev => [...prev, created]);
                        setSelectedCallId(created.id);
                    })}>{t('New Call')}</button>
                </div>
                <div className="list-group">
                    {calls.map(call => <button key={call.id} disabled={busy} aria-current={selectedCallId === call.id ? 'true' : undefined} className={`list-group-item list-group-item-action ${selectedCallId === call.id ? 'active' : ''}`} onClick={() => setSelectedCallId(call.id)}>
                        <span className="fw-semibold d-block">{call.title}</span>
                        <small className="d-block">{call.issuer}</small>
                        <small>{t(`grants.callStatus.${call.status}`)}{call.deadline ? ` · ${call.deadline}` : ''}</small>
                    </button>)}
                    {!calls.length && <p className="text-muted small p-3">{t('No grant calls yet')}</p>}
                </div>
            </div>
            <div className="col-md-8">
                {selectedCall ? <div className="card">
                    <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <h6 className="mb-0">{selectedCall.title}</h6>
                        <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => remove(async () => {
                            await librepm.grantCallDelete(projectId, selectedCall.id);
                            setCalls(prev => prev.filter(c => c.id !== selectedCall.id));
                            setSelectedCallId(null);
                            setRequirementsData({ callId: null, items: [] });
                        })}>{t('Delete')}</button>
                    </div>
                    <div className="card-body">
                        <CallForm key={selectedCall.id} call={selectedCall} busy={busy} onSave={updateCall} />
                        <hr className="my-4" />
                        <h6>{t('Requirements')}</h6>
                        {requirementsError ? <div className="alert alert-danger" role="alert">{requirementsError}<button className="btn btn-sm btn-outline-danger ms-2" onClick={() => setReload(v => v + 1)}>{t('Retry')}</button></div> : requirementsLoading || requirementsData.callId !== selectedCallId ? <p role="status">{t('Loading...')}</p> : <>
                            <RequirementForm key={`new-${selectedCallId}`} busy={busy} onSave={data => {
                                const callId = selectedCallId;
                                return write(async () => {
                                    const created = await librepm.grantRequirementCreate(projectId, callId, data);
                                    if (currentCall.current === callId) setRequirementsData(prev => ({ callId, items: [...prev.items, created] }));
                                });
                            }} />
                            <div className="list-group mt-3">
                                {requirements.map(requirement => <div className="list-group-item" key={requirement.id}>
                                    <RequirementForm requirement={requirement} busy={busy} onSave={data => updateRequirement(requirement.id, data)} onDelete={() => remove(async () => {
                                        const callId = selectedCallId;
                                        await librepm.grantRequirementDelete(projectId, callId, requirement.id);
                                        if (currentCall.current === callId) setRequirementsData(prev => ({ callId, items: prev.items.filter(r => r.id !== requirement.id) }));
                                    })} />
                                </div>)}
                            </div>
                            <p className="mt-2 small text-muted">{t('Met')}: {requirements.filter(r => r.isMet).length}/{requirements.length}</p>
                        </>}
                    </div>
                </div> : <p className="text-center text-muted p-5">{t('Select a call to view details')}</p>}
            </div>
        </div>}

        {tab === 'obligations' && <>
            <button className="btn btn-sm btn-primary mb-3" disabled={busy} onClick={() => write(async () => {
                const created = await librepm.grantObligationCreate(projectId, { title: t('New obligation') });
                setObligations(prev => [...prev, created]);
            })}>{t('Add')}</button>
            {!obligations.length && <p className="text-muted">{t('No obligations')}</p>}
            <div className="row g-3">{obligations.map(obligation => <div className="col-lg-6" key={obligation.id}>
                <div className="card card-body"><ObligationForm obligation={obligation} busy={busy} onSave={data => write(async () => {
                    const updated = await librepm.grantObligationUpdate(projectId, obligation.id, data);
                    setObligations(prev => prev.map(o => o.id === updated.id ? updated : o));
                    toast.success(t('Saved successfully'));
                })} onDelete={() => remove(async () => {
                    await librepm.grantObligationDelete(projectId, obligation.id);
                    setObligations(prev => prev.filter(o => o.id !== obligation.id));
                })} /></div>
            </div>)}</div>
        </>}

        {tab === 'reporting' && <>
            <button className="btn btn-sm btn-primary mb-3" disabled={busy} onClick={() => write(async () => {
                // Keep date-only values in the user's local calendar.
                const today = new Date();
                const end = new Date(today);
                end.setDate(end.getDate() + 90);
                const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const created = await librepm.grantReportingPeriodCreate(projectId, { name: t('New period'), periodStart: localDate(today), periodEnd: localDate(end) });
                setPeriods(prev => [...prev, created]);
            })}>{t('Add')}</button>
            {!periods.length && <p className="text-muted">{t('No reporting periods')}</p>}
            <div className="row g-3">{periods.map(period => <div className="col-lg-6" key={period.id}>
                <div className="card card-body"><ReportingPeriodForm period={period} busy={busy} onSave={data => write(async () => {
                    const updated = await librepm.grantReportingPeriodUpdate(projectId, period.id, data);
                    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
                    toast.success(t('Saved successfully'));
                })} onDelete={() => remove(async () => {
                    await librepm.grantReportingPeriodDelete(projectId, period.id);
                    setPeriods(prev => prev.filter(p => p.id !== period.id));
                })} /></div>
            </div>)}</div>
        </>}
    </div>;
}

function Field({ label, children, className = 'col-12' }) {
    return <label className={`${className} form-label mb-0`}><span className="d-block mb-1">{label}</span>{children}</label>;
}

function CallForm({ call, busy, onSave }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(call);
    useEffect(() => { setDraft(call); }, [call]);
    const change = field => e => setDraft(prev => ({ ...prev, [field]: e.target.value }));
    return <form onSubmit={e => {
        e.preventDefault();
        onSave({ ...draft, title: draft.title.trim(), deadline: draft.deadline || null, budgetAvailable: draft.budgetAvailable === '' || draft.budgetAvailable == null ? null : Number(draft.budgetAvailable) });
    }}><fieldset disabled={busy} className="row g-3">
        <Field label={t('Title')} className="col-md-8"><input className="form-control" required value={draft.title || ''} onChange={change('title')} /></Field>
        <Field label={t('Status')} className="col-md-4"><select className="form-select" value={draft.status || 'IDENTIFIED'} onChange={change('status')}>{CALL_STATUSES.map(s => <option key={s} value={s}>{t(`grants.callStatus.${s}`)}</option>)}</select></Field>
        <Field label={t('Issuer')} className="col-md-6"><input className="form-control" value={draft.issuer || ''} onChange={change('issuer')} /></Field>
        <Field label={t('Deadline')} className="col-md-6"><input type="date" className="form-control" value={draft.deadline || ''} onChange={change('deadline')} /></Field>
        <Field label={t('Budget Available')} className="col-md-8"><input type="number" min="0" step="0.01" className="form-control" value={draft.budgetAvailable ?? ''} onChange={change('budgetAvailable')} /></Field>
        <Field label={t('Currency')} className="col-md-4"><input className="form-control" required minLength={3} maxLength={3} value={draft.currency || 'EUR'} onChange={change('currency')} /></Field>
        <Field label={t('Description')}><textarea className="form-control" rows={3} value={draft.description || ''} onChange={change('description')} /></Field>
        <Field label={t('Reference Code')} className="col-md-6"><input className="form-control" value={draft.referenceCode || ''} onChange={change('referenceCode')} /></Field>
        <Field label={t('URL')} className="col-md-6"><input type="url" className="form-control" value={draft.url || ''} onChange={change('url')} /></Field>
        <div className="col-12"><button type="submit" className="btn btn-sm btn-primary">{t('Save')}</button></div>
    </fieldset></form>;
}

function RequirementForm({ requirement, busy, onSave, onDelete }) {
    const { t } = useTranslation();
    const empty = { description: '', requirementType: 'ELIGIBILITY', evidenceNote: '', isMet: false };
    const [draft, setDraft] = useState(requirement || empty);
    useEffect(() => { if (requirement) setDraft(requirement); }, [requirement]);
    return <form onSubmit={async e => {
        e.preventDefault();
        if (await onSave({ ...draft, description: draft.description.trim() }) && !requirement) setDraft(empty);
    }}><fieldset disabled={busy} className="row g-2 align-items-end">
        <Field label={t('Description')} className="col-md-8"><input className="form-control form-control-sm" required value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
        <Field label={t('Type')} className="col-md-4"><select className="form-select form-select-sm" value={draft.requirementType || 'ELIGIBILITY'} onChange={e => setDraft({ ...draft, requirementType: e.target.value })}>{REQ_TYPES.map(type => <option key={type} value={type}>{t(`grants.reqType.${type}`)}</option>)}</select></Field>
        {requirement && <><Field label={t('Evidence note')}><textarea className="form-control form-control-sm" rows={2} value={draft.evidenceNote || ''} onChange={e => setDraft({ ...draft, evidenceNote: e.target.value })} /></Field>
            <div className="col-12"><label className="form-check"><input type="checkbox" className="form-check-input" checked={!!draft.isMet} onChange={e => setDraft({ ...draft, isMet: e.target.checked })} /><span className="form-check-label">{t('Met')}</span></label></div></>}
        <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-sm btn-outline-primary">{t(requirement ? 'Save' : 'Add')}</button>{onDelete && <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete}>{t('Delete')}</button>}</div>
    </fieldset></form>;
}

function ObligationForm({ obligation, busy, onSave, onDelete }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(obligation);
    useEffect(() => { setDraft(obligation); }, [obligation]);
    const change = field => e => setDraft(prev => ({ ...prev, [field]: e.target.value }));
    return <form onSubmit={e => { e.preventDefault(); onSave({ ...draft, title: draft.title.trim(), deadline: draft.deadline || null }); }}><fieldset disabled={busy} className="row g-3">
        <Field label={t('Title')}><input className="form-control" required value={draft.title || ''} onChange={change('title')} /></Field>
        <Field label={t('Type')} className="col-md-6"><select className="form-select" value={draft.type || ''} onChange={change('type')}><option value="">-</option>{OBL_TYPES.map(type => <option key={type} value={type}>{t(`grants.oblType.${type}`)}</option>)}</select></Field>
        <Field label={t('Status')} className="col-md-6"><select className="form-select" value={draft.status} onChange={change('status')}>{OBL_STATUSES.map(s => <option key={s} value={s}>{t(`grants.oblStatus.${s}`)}</option>)}</select></Field>
        <Field label={t('Deadline')}><input type="date" className="form-control" value={draft.deadline || ''} onChange={change('deadline')} /></Field>
        <Field label={t('Description')}><textarea className="form-control" rows={2} value={draft.description || ''} onChange={change('description')} /></Field>
        <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-sm btn-primary">{t('Save')}</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete}>{t('Delete')}</button></div>
    </fieldset></form>;
}

function ReportingPeriodForm({ period, busy, onSave, onDelete }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(period);
    useEffect(() => { setDraft(period); }, [period]);
    const change = field => e => setDraft(prev => ({ ...prev, [field]: e.target.value }));
    return <form onSubmit={e => { e.preventDefault(); onSave({ ...draft, name: draft.name.trim(), dueDate: draft.dueDate || null }); }}><fieldset disabled={busy} className="row g-3">
        <Field label={t('Name')} className="col-md-8"><input className="form-control" required value={draft.name || ''} onChange={change('name')} /></Field>
        <Field label={t('Status')} className="col-md-4"><select className="form-select" value={draft.status} onChange={change('status')}>{RP_STATUSES.map(s => <option key={s} value={s}>{t(`grants.rpStatus.${s}`)}</option>)}</select></Field>
        <Field label={t('Start Date')} className="col-md-6"><input type="date" className="form-control" required max={draft.periodEnd || undefined} value={draft.periodStart || ''} onChange={change('periodStart')} /></Field>
        <Field label={t('End Date')} className="col-md-6"><input type="date" className="form-control" required min={draft.periodStart || undefined} value={draft.periodEnd || ''} onChange={change('periodEnd')} /></Field>
        <Field label={t('Due')}><input type="date" className="form-control" value={draft.dueDate || ''} onChange={change('dueDate')} /></Field>
        <Field label={t('Notes')}><textarea className="form-control" rows={2} value={draft.notes || ''} onChange={change('notes')} /></Field>
        <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-sm btn-primary">{t('Save')}</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete}>{t('Delete')}</button></div>
    </fieldset></form>;
}
