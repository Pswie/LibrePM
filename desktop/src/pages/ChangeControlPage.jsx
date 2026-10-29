import { useState, useEffect, useCallback } from 'react';
import { librepm } from '@api/librepm.js';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

/**
 * ChangeControlPage — Manages change requests, branches, and decision log.
 * Tabs: Change Requests, Branches, Decision Log.
 */
export default function ChangeControlPage({ shell }) {
    const { t } = useTranslation();
    const projectId = shell?.currentProject?.id;
    const [tab, setTab] = useState('requests');

    const [requests, setRequests] = useState([]);
    const [branches, setBranches] = useState([]);
    const [decisions, setDecisions] = useState([]);
    const [editingCR, setEditingCR] = useState(null);

    useEffect(() => { shell?.setTitle?.(t("Change Control")); }, []);

    // =========== LOADERS ===========

    const loadRequests = useCallback(async () => {
        if (!projectId) return;
        try { setRequests(await librepm.changeRequestsList(projectId) || []); } catch (e) { console.error(e); }
    }, [projectId]);

    const loadBranches = useCallback(async () => {
        if (!projectId) return;
        try { setBranches(await librepm.branchesList(projectId) || []); } catch (e) { console.error(e); }
    }, [projectId]);

    const loadDecisions = useCallback(async () => {
        if (!projectId) return;
        try { setDecisions(await librepm.decisionLogList(projectId) || []); } catch (e) { console.error(e); }
    }, [projectId]);

    useEffect(() => { loadRequests(); loadBranches(); loadDecisions(); }, [loadRequests, loadBranches, loadDecisions]);

    // =========== HANDLERS ===========

    const handleCreateCR = async () => {
        try {
            const cr = await librepm.changeRequestCreate(projectId, {
                title: t("New change request"),
                requestedBy: shell?.currentUser?.id
            });
            setRequests(prev => [cr, ...prev]);
            setEditingCR(cr);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleUpdateCR = async (crId, data) => {
        try {
            const updated = await librepm.changeRequestUpdate(projectId, crId, data);
            setRequests(prev => prev.map(r => r.id === crId ? updated : r));
            if (editingCR?.id === crId) setEditingCR(updated);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleDeleteCR = async (crId) => {
        try {
            await librepm.changeRequestDelete(projectId, crId);
            setRequests(prev => prev.filter(r => r.id !== crId));
            if (editingCR?.id === crId) setEditingCR(null);
            toast.success(t("Deleted successfully"));
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleCreateBranch = async () => {
        try {
            const b = await librepm.branchCreate(projectId, {
                name: t("New branch"),
                branchType: 'SCENARIO',
                createdBy: shell?.currentUser?.id
            });
            setBranches(prev => [b, ...prev]);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleCreateDecision = async () => {
        try {
            const d = await librepm.decisionLogCreate(projectId, {
                title: t("New decision"),
                decision: '',
                decidedBy: shell?.currentUser?.id
            });
            setDecisions(prev => [d, ...prev]);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleBranchStatus = async (branchId, status) => {
        try {
            const updated = await librepm.branchUpdate(projectId, branchId, { status });
            setBranches(prev => prev.map(branch => branch.id === branchId ? updated : branch));
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    // =========== STATUS HELPERS ===========

    const crStatusColor = (status) => {
        const colors = { DRAFT: 'secondary', SUBMITTED: 'info', IN_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger', IMPLEMENTED: 'primary' };
        return colors[status] || 'secondary';
    };

    const branchStatusColor = (status) => {
        const colors = { ACTIVE: 'info', APPROVED: 'success', REJECTED: 'danger', MERGED: 'primary', ARCHIVED: 'secondary' };
        return colors[status] || 'secondary';
    };

    const priorityColor = (p) => {
        const colors = { LOW: 'success', MEDIUM: 'warning', HIGH: 'orange', CRITICAL: 'danger' };
        return colors[p] || 'secondary';
    };

    const CR_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED'];
    const CR_SCOPES = ['SCHEDULE', 'BUDGET', 'SCOPE', 'RESOURCES', 'ALL'];
    const CR_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const BRANCH_TYPES = ['SCENARIO', 'REFORECAST', 'CANDIDATURE', 'PIVOT', 'SPINOFF', 'EVOLUTIVE'];
    const BRANCH_STATUSES = ['ACTIVE', 'APPROVED', 'REJECTED', 'ARCHIVED'];

    // =========== RENDER ===========

    if (!projectId) {
        return <div className="container-fluid p-4 text-center text-muted">
            <i className="bi bi-folder2-open fs-1 d-block mb-3"></i>
            <p>{t("Select a project")}</p>
        </div>;
    }

    return (
        <div className="container-fluid p-4">
            <ul className="nav nav-tabs mb-4">
                {[
                    { key: 'requests', icon: 'bi-pencil-square', label: t("Change Requests") },
                    { key: 'branches', icon: 'bi-signpost-split', label: t("Branches") },
                    { key: 'decisions', icon: 'bi-journal-check', label: t("Decision Log") },
                ].map(({ key, icon, label }) => (
                    <li className="nav-item" key={key}>
                        <button className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                            <i className={`bi ${icon} me-1`}></i>{label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* CHANGE REQUESTS TAB */}
            {tab === 'requests' && (
                <div className="row">
                    <div className="col-md-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">{t("Change Requests")}</h6>
                            <button className="btn btn-sm btn-primary" onClick={handleCreateCR}>
                                <i className="bi bi-plus me-1"></i>{t("New")}
                            </button>
                        </div>
                        <div className="list-group">
                            {requests.map(cr => (
                                <button key={cr.id}
                                    className={`list-group-item list-group-item-action ${editingCR?.id === cr.id ? 'active' : ''}`}
                                    onClick={() => setEditingCR(cr)}>
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div className="fw-semibold">{cr.title}</div>
                                        <span className={`badge bg-${crStatusColor(cr.status)}`}>{t(`changeControl.crStatus.${cr.status}`)}</span>
                                    </div>
                                    <div className="d-flex gap-2 mt-1">
                                        {cr.priority && <small className={`text-${priorityColor(cr.priority)}`}>{t(`changeControl.priority.${cr.priority}`)}</small>}
                                        {cr.scope && <small className="text-muted">{t(`changeControl.crScope.${cr.scope}`)}</small>}
                                    </div>
                                </button>
                            ))}
                            {requests.length === 0 && <p className="text-muted small p-3">{t("No change requests")}</p>}
                        </div>
                    </div>
                    <div className="col-md-8">
                        {editingCR ? (
                            <div className="card">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0">{editingCR.title}</h6>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCR(editingCR.id)}>
                                        <i className="bi bi-trash me-1"></i>{t("Delete")}
                                    </button>
                                </div>
                                <div className="card-body">
                                    <div className="row g-3">
                                        <div className="col-md-8">
                                            <label className="form-label">{t("Title")}</label>
                                            <input className="form-control" value={editingCR.title || ''}
                                                onChange={e => setEditingCR({ ...editingCR, title: e.target.value })}
                                                onBlur={() => handleUpdateCR(editingCR.id, { title: editingCR.title })} />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t("Status")}</label>
                                            <select className="form-select" value={editingCR.status || 'DRAFT'}
                                                onChange={e => handleUpdateCR(editingCR.id, { status: e.target.value })}>
                                                {CR_STATUSES.map(s => <option key={s} value={s}>{t(`changeControl.crStatus.${s}`)}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t("Priority")}</label>
                                            <select className="form-select" value={editingCR.priority || 'MEDIUM'}
                                                onChange={e => handleUpdateCR(editingCR.id, { priority: e.target.value })}>
                                                {CR_PRIORITIES.map(p => <option key={p} value={p}>{t(`changeControl.priority.${p}`)}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t("Scope")}</label>
                                            <select className="form-select" value={editingCR.scope || ''}
                                                onChange={e => handleUpdateCR(editingCR.id, { scope: e.target.value })}>
                                                <option value="">-</option>
                                                {CR_SCOPES.map(s => <option key={s} value={s}>{t(`changeControl.crScope.${s}`)}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">{t("Description")}</label>
                                            <textarea className="form-control" rows={3} value={editingCR.description || ''}
                                                onChange={e => setEditingCR({ ...editingCR, description: e.target.value })}
                                                onBlur={() => handleUpdateCR(editingCR.id, { description: editingCR.description })} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">{t("Motivation")}</label>
                                            <textarea className="form-control" rows={2} value={editingCR.motivation || ''}
                                                onChange={e => setEditingCR({ ...editingCR, motivation: e.target.value })}
                                                onBlur={() => handleUpdateCR(editingCR.id, { motivation: editingCR.motivation })} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">{t("Expected Impact")}</label>
                                            <textarea className="form-control" rows={2} value={editingCR.expectedImpact || ''}
                                                onChange={e => setEditingCR({ ...editingCR, expectedImpact: e.target.value })}
                                                onBlur={() => handleUpdateCR(editingCR.id, { expectedImpact: editingCR.expectedImpact })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-muted p-5">
                                <i className="bi bi-pencil-square fs-1 d-block mb-3"></i>
                                <p>{t("Select a change request to edit")}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* BRANCHES TAB */}
            {tab === 'branches' && (
                <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">{t("Project Branches")}</h6>
                        <button className="btn btn-sm btn-primary" onClick={handleCreateBranch}>
                            <i className="bi bi-plus me-1"></i>{t("New Branch")}
                        </button>
                    </div>
                    {branches.length > 0 ? (
                        <div className="row g-3">
                            {branches.map(b => (
                                <div className="col-md-4" key={b.id}>
                                    <div className="card h-100">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <h6 className="mb-0">{b.name}</h6>
                                                    <small className="badge bg-light text-dark">{t(`changeControl.branchType.${b.branchType}`)}</small>
                                                </div>
                                                <select className={`form-select form-select-sm text-${branchStatusColor(b.status)}`} style={{ width: 'auto' }}
                                                    value={b.status}
                                                    aria-label={t("Status")}
                                                    onChange={e => handleBranchStatus(b.id, e.target.value)}>
                                                    {b.status === 'MERGED' && <option value="MERGED" disabled>{t('changeControl.branchStatus.MERGED')}</option>}
                                                    {BRANCH_STATUSES.map(s => <option key={s} value={s}>{t(`changeControl.branchStatus.${s}`)}</option>)}
                                                </select>
                                            </div>
                                            {b.description && <p className="small text-muted mb-2">{b.description}</p>}
                                            <div className="small text-muted">
                                                <i className="bi bi-calendar me-1"></i>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '-'}
                                            </div>
                                            {b.changeRequestId && (
                                                <div className="small mt-1">
                                                    <i className="bi bi-link-45deg me-1"></i>{t("Linked CR")}: {b.changeRequestId.substring(0, 8)}...
                                                </div>
                                            )}
                                        </div>
                                        <div className="card-footer bg-transparent d-flex justify-content-end">
                                            <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                                                await librepm.branchDelete(projectId, b.id);
                                                setBranches(prev => prev.filter(x => x.id !== b.id));
                                            }}><i className="bi bi-trash me-1"></i>{t("Delete")}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted">{t("No branches")}</p>
                    )}
                </div>
            )}

            {/* DECISION LOG TAB */}
            {tab === 'decisions' && (
                <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">{t("Decision Log")}</h6>
                        <button className="btn btn-sm btn-primary" onClick={handleCreateDecision}>
                            <i className="bi bi-plus me-1"></i>{t("Add")}
                        </button>
                    </div>
                    {decisions.length > 0 ? (
                        <div className="list-group">
                            {decisions.map(d => (
                                <div key={d.id} className="list-group-item">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div className="flex-grow-1">
                                            <input className="form-control form-control-sm fw-semibold border-0 p-0 mb-1"
                                                value={d.title}
                                                onChange={e => setDecisions(prev => prev.map(x => x.id === d.id ? { ...x, title: e.target.value } : x))}
                                                onBlur={() => librepm.decisionLogUpdate(projectId, d.id, { title: d.title })} />
                                            <textarea className="form-control form-control-sm border-0 p-0" rows={2} placeholder={t("Decision")}
                                                value={d.decision || ''}
                                                onChange={e => setDecisions(prev => prev.map(x => x.id === d.id ? { ...x, decision: e.target.value } : x))}
                                                onBlur={() => librepm.decisionLogUpdate(projectId, d.id, { decision: d.decision })} />
                                            <textarea className="form-control form-control-sm border-0 p-0 text-muted mt-1" rows={1} placeholder={t("Rationale")}
                                                value={d.rationale || ''}
                                                onChange={e => setDecisions(prev => prev.map(x => x.id === d.id ? { ...x, rationale: e.target.value } : x))}
                                                onBlur={() => librepm.decisionLogUpdate(projectId, d.id, { rationale: d.rationale })} />
                                        </div>
                                        <div className="ms-3 text-end">
                                            <small className="text-muted d-block">{d.decidedAt ? new Date(d.decidedAt).toLocaleDateString() : ''}</small>
                                            <button className="btn btn-sm btn-outline-danger mt-1" onClick={async () => {
                                                await librepm.decisionLogDelete(projectId, d.id);
                                                setDecisions(prev => prev.filter(x => x.id !== d.id));
                                            }}><i className="bi bi-trash"></i></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted">{t("No decisions recorded")}</p>
                    )}
                </div>
            )}
        </div>
    );
}
