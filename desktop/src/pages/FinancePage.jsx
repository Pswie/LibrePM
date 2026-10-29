import React, { useState, useEffect, useCallback, useRef } from 'react';
import { librepm } from '@api/librepm.js';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

/**
 * FinancePage - Project Finance management (Phase 18 / PRD-18).
 * Tabs: Budget, Funding, Costs, Analytics.
 */
export default function FinancePage({ shell }) {
    return <ProjectFinance key={shell?.currentProject?.id || 'none'} shell={shell} />;
}

function ProjectFinance({ shell }) {
    const { t } = useTranslation();
    const projectId = shell?.currentProject?.id;
    const [tab, setTab] = useState('budget');
    const [loading, setLoading] = useState(false);
    const [loadingLines, setLoadingLines] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [reload, setReload] = useState(0);
    const lineRequest = useRef(0);

    // Budget state
    const [budgets, setBudgets] = useState([]);
    const [selectedBudget, setSelectedBudget] = useState(null);
    const selectedBudgetId = useRef(null);
    selectedBudgetId.current = selectedBudget?.id;
    const [lines, setLines] = useState([]);

    // Funding state
    const [funding, setFunding] = useState([]);

    // Analytics state
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        shell?.setTitle?.(t("Finance"));
        shell?.setHeaderActions?.(null);
        shell?.setRightPanel?.(null);
    }, [shell, t]);

    // Load data
    const loadLines = useCallback(async (budgetId) => {
        if (!projectId || !budgetId) return;
        const requestId = ++lineRequest.current;
        setLines([]);
        setLoadingLines(true);
        setLoadError('');
        try {
            const l = await librepm.financeLinesList(projectId, budgetId);
            if (requestId === lineRequest.current) setLines(l || []);
        } catch (e) {
            if (requestId === lineRequest.current) setLoadError(e.message);
        } finally { if (requestId === lineRequest.current) setLoadingLines(false); }
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return undefined;
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        const request = tab === 'budget' ? librepm.financeBudgetsList(projectId)
            : tab === 'funding' ? librepm.financeFundingList(projectId) : librepm.financeAnalytics(projectId);
        request.then(data => {
            if (cancelled) return;
            if (tab === 'budget') {
                setBudgets(data || []);
                setSelectedBudget(previous => data?.find(b => b.id === previous?.id) || data?.[0] || null);
            } else if (tab === 'funding') setFunding(data || []);
            else setAnalytics(data);
        }).catch(error => { if (!cancelled) setLoadError(error.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tab, projectId, reload]);

    useEffect(() => {
        if (selectedBudget?.id) loadLines(selectedBudget.id);
        else setLines([]);
        return () => { lineRequest.current += 1; };
    }, [selectedBudget?.id, loadLines, reload]);

    // Handlers
    const handleCreateBudget = async () => {
        try {
            const b = await librepm.financeBudgetCreate(projectId, { name: `Budget v${budgets.length + 1}` });
            toast.success(t("Budget created"));
            setBudgets(prev => [b, ...prev]);
            setSelectedBudget(b);
            setLines([]);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleAddLine = async () => {
        if (!selectedBudget) return;
        const budgetId = selectedBudget.id;
        try {
            const l = await librepm.financeLineCreate(projectId, budgetId, {
                name: t("New budget line"),
                category: 'MISC',
                plannedAmount: 0,
            });
            if (selectedBudgetId.current === budgetId) setLines(prev => [...prev, l]);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleUpdateLine = async (lineId, field, value) => {
        try {
            const updated = await librepm.financeLineUpdate(projectId, lineId, { [field]: value });
            setLines(prev => prev.map(l => l.id === lineId ? updated : l));
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleAddFunding = async () => {
        try {
            const f = await librepm.financeFundingCreate(projectId, { name: t("New funding source"), type: 'INTERNAL' });
            setFunding(prev => [...prev, f]);
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleUpdateFunding = async (fundId, field, value) => {
        try {
            const updated = await librepm.financeFundingUpdate(projectId, fundId, { [field]: value });
            setFunding(prev => prev.map(f => f.id === fundId ? updated : f));
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    const handleApproveBudget = async () => {
        if (!selectedBudget) return;
        try {
            const userId = librepm.getCurrentUser();
            const b = await librepm.financeBudgetApprove(projectId, selectedBudget.id, userId);
            setSelectedBudget(b);
            setBudgets(prev => prev.map(x => x.id === b.id ? b : x));
            toast.success(t("Budget approved"));
        } catch (e) { toast.error(t("Error") + ': ' + e.message); }
    };

    if (!projectId) {
        return (
            <div className="text-center py-5 text-muted">
                <i className="bi bi-folder2-open fs-1 d-block mb-3"></i>
                <p>{t("Select a project")}</p>
            </div>
        );
    }

    const CATEGORIES = ['PERSONNEL', 'SUPPLIERS', 'SOFTWARE', 'TRAVEL', 'EVENTS', 'EQUIPMENT', 'OVERHEAD', 'MISC'];
    const FUND_TYPES = ['INTERNAL', 'GRANT', 'SPONSOR', 'DONATION', 'CO_FUNDING'];

    return (
        <div className="container-fluid p-4">
            {/* Tabs */}
            <ul className="nav nav-tabs mb-4">
                {['budget', 'funding', 'analytics'].map(t2 => (
                    <li className="nav-item" key={t2}>
                        <button className={`nav-link ${tab === t2 ? 'active' : ''}`} onClick={() => setTab(t2)}>
                            <i className={`bi ${t2 === 'budget' ? 'bi-calculator' : t2 === 'funding' ? 'bi-cash-stack' : 'bi-graph-up'} me-1`}></i>
                            {t(t2.charAt(0).toUpperCase() + t2.slice(1))}
                        </button>
                    </li>
                ))}
            </ul>

            {loading && <p role="status">{t('Loading...')}</p>}
            {loadError && <div className="alert alert-danger" role="alert">{loadError}<button className="btn btn-sm btn-outline-danger ms-2" onClick={() => setReload(v => v + 1)}>{t('Retry')}</button></div>}

            {/* Budget Tab */}
            {tab === 'budget' && (
                <div>
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <select className="form-select form-select-sm" style={{ width: 250 }}
                                value={selectedBudget?.id || ''}
                                aria-label={t('Budget')}
                                onChange={(e) => {
                                    const b = budgets.find(x => x.id === e.target.value);
                                    setSelectedBudget(b);
                                }}>
                            {budgets.map(b => (
                                <option key={b.id} value={b.id}>{b.name} (v{b.version}) — {b.status}</option>
                            ))}
                        </select>
                        <button className="btn btn-sm btn-primary" onClick={handleCreateBudget}>
                            <i className="bi bi-plus me-1"></i>{t("New Budget")}
                        </button>
                        {selectedBudget && selectedBudget.status === 'DRAFT' && (
                            <button className="btn btn-sm btn-success" onClick={handleApproveBudget}>
                                <i className="bi bi-check-lg me-1"></i>{t("Approve")}
                            </button>
                        )}
                    </div>

                    {selectedBudget && (
                        <>
                            <div className="table-responsive">
                                <table className="table table-sm table-hover">
                                    <thead>
                                        <tr className="small">
                                            <th>{t("Name")}</th>
                                            <th>{t("Category")}</th>
                                            <th className="text-end">{t("Planned")}</th>
                                            <th className="text-end">{t("Committed")}</th>
                                            <th className="text-end">{t("Actual")}</th>
                                            <th className="text-end">{t("Forecast")}</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map(line => (
                                            <tr key={line.id} className="small">
                                                <td>
                                                    <input className="form-control form-control-sm border-0 p-0" value={line.name}
                                                           onChange={e => setLines(prev => prev.map(l => l.id === line.id ? {...l, name: e.target.value} : l))}
                                                           onBlur={e => handleUpdateLine(line.id, 'name', e.target.value)} />
                                                </td>
                                                <td>
                                                    <select className="form-select form-select-sm border-0 p-0" value={line.category}
                                                            onChange={e => handleUpdateLine(line.id, 'category', e.target.value)}>
                                                        {CATEGORIES.map(c => <option key={c} value={c}>{t(`finance.category.${c}`)}</option>)}
                                                    </select>
                                                </td>
                                                {['plannedAmount', 'committedAmount', 'actualAmount', 'forecastAmount'].map(field => (
                                                    <td key={field} className="text-end">
                                                        <input type="number" className="form-control form-control-sm border-0 p-0 text-end"
                                                               style={{ width: 90 }}
                                                               value={line[field] || 0}
                                                               onChange={e => setLines(prev => prev.map(l => l.id === line.id ? {...l, [field]: parseFloat(e.target.value) || 0} : l))}
                                                               onBlur={e => handleUpdateLine(line.id, field, parseFloat(e.target.value) || 0)} />
                                                    </td>
                                                ))}
                                                <td>
                                                    <button className="btn btn-sm btn-link text-danger p-0"
                                                            onClick={async () => {
                                                                try {
                                                                    await librepm.financeLineDelete(projectId, line.id);
                                                                    setLines(prev => prev.filter(l => l.id !== line.id));
                                                                } catch (error) { toast.error(`${t('Error')}: ${error.message}`); }
                                                            }}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold small">
                                            <td colSpan={2}>{t("Total")}</td>
                                            <td className="text-end">{lines.reduce((s, l) => s + (l.plannedAmount || 0), 0).toLocaleString()}</td>
                                            <td className="text-end">{lines.reduce((s, l) => s + (l.committedAmount || 0), 0).toLocaleString()}</td>
                                            <td className="text-end">{lines.reduce((s, l) => s + (l.actualAmount || 0), 0).toLocaleString()}</td>
                                            <td className="text-end">{lines.reduce((s, l) => s + (l.forecastAmount || 0), 0).toLocaleString()}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            {loadingLines && <p role="status">{t('Loading...')}</p>}
                            <button className="btn btn-sm btn-outline-primary" disabled={loading || loadingLines} onClick={handleAddLine}>
                                <i className="bi bi-plus me-1"></i>{t("Add Line")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Funding Tab */}
            {tab === 'funding' && (
                <div>
                    <div className="mb-3">
                        <button className="btn btn-sm btn-primary" onClick={handleAddFunding}>
                            <i className="bi bi-plus me-1"></i>{t("Add Funding Source")}
                        </button>
                    </div>
                    {funding.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle">
                                <thead>
                                    <tr className="small">
                                        <th>{t("Name")}</th>
                                        <th>{t("Type")}</th>
                                        <th className="text-end">{t("Total Amount")}</th>
                                        <th style={{ width: 70 }}>{t("Currency")}</th>
                                        <th>{t("Status")}</th>
                                        <th>{t("Contact Name")}</th>
                                        <th>{t("Contact Email")}</th>
                                        <th style={{ width: 80 }}>{t("Restricted")}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {funding.map(f => (
                                        <React.Fragment key={f.id}>
                                            <tr className="small">
                                                <td>
                                                    <input className="form-control form-control-sm border-0 p-0" value={f.name || ''}
                                                        onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, name: e.target.value } : x))}
                                                        onBlur={e => handleUpdateFunding(f.id, 'name', e.target.value)} />
                                                </td>
                                                <td>
                                                    <select className="form-select form-select-sm border-0 p-0" value={f.type || 'INTERNAL'}
                                                        onChange={e => { setFunding(prev => prev.map(x => x.id === f.id ? { ...x, type: e.target.value } : x)); handleUpdateFunding(f.id, 'type', e.target.value); }}>
                                                        {FUND_TYPES.map(ft => <option key={ft} value={ft}>{t(`finance.fundType.${ft}`)}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input type="number" className="form-control form-control-sm border-0 p-0 text-end" style={{ width: 100 }}
                                                        value={f.totalAmount || 0}
                                                        onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, totalAmount: parseFloat(e.target.value) || 0 } : x))}
                                                        onBlur={e => handleUpdateFunding(f.id, 'totalAmount', parseFloat(e.target.value) || 0)} />
                                                </td>
                                                <td>
                                                    <input className="form-control form-control-sm border-0 p-0" value={f.currency || ''} style={{ width: 60 }}
                                                        onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, currency: e.target.value } : x))}
                                                        onBlur={e => handleUpdateFunding(f.id, 'currency', e.target.value)} />
                                                </td>
                                                <td>
                                                    <select className="form-select form-select-sm border-0 p-0" value={f.status || 'ACTIVE'}
                                                        onChange={e => { setFunding(prev => prev.map(x => x.id === f.id ? { ...x, status: e.target.value } : x)); handleUpdateFunding(f.id, 'status', e.target.value); }}>
                                                        {['ACTIVE', 'PENDING', 'EXHAUSTED', 'CANCELLED'].map(s => <option key={s} value={s}>{t(`finance.fundingStatus.${s}`)}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input className="form-control form-control-sm border-0 p-0" value={f.contactName || ''}
                                                        onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, contactName: e.target.value } : x))}
                                                        onBlur={e => handleUpdateFunding(f.id, 'contactName', e.target.value)} />
                                                </td>
                                                <td>
                                                    <input className="form-control form-control-sm border-0 p-0" value={f.contactEmail || ''}
                                                        onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, contactEmail: e.target.value } : x))}
                                                        onBlur={e => handleUpdateFunding(f.id, 'contactEmail', e.target.value)} />
                                                </td>
                                                <td className="text-center">
                                                    <input type="checkbox" className="form-check-input" checked={f.restricted || false}
                                                        onChange={e => { setFunding(prev => prev.map(x => x.id === f.id ? { ...x, restricted: e.target.checked } : x)); handleUpdateFunding(f.id, 'restricted', e.target.checked); }} />
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-link text-danger p-0"
                                                        onClick={async () => {
                                                            try {
                                                                await librepm.financeFundingDelete(projectId, f.id);
                                                                setFunding(prev => prev.filter(x => x.id !== f.id));
                                                            } catch (error) { toast.error(`${t('Error')}: ${error.message}`); }
                                                        }}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                            {f.restricted && (
                                                <tr className="small">
                                                    <td colSpan={9} className="pt-0 ps-4">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <i className="bi bi-lock text-warning"></i>
                                                            <input className="form-control form-control-sm border-0 p-0" placeholder={t("Restriction description...")}
                                                                value={f.restrictionDescription || ''}
                                                                onChange={e => setFunding(prev => prev.map(x => x.id === f.id ? { ...x, restrictionDescription: e.target.value } : x))}
                                                                onBlur={e => handleUpdateFunding(f.id, 'restrictionDescription', e.target.value)} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-muted py-4">
                            <i className="bi bi-cash-stack fs-1 d-block mb-2"></i>
                            <p>{t("No funding sources")}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Analytics Tab */}
            {tab === 'analytics' && (
                <div>
                    {!analytics?.hasBudget ? (
                        <div className="text-center text-muted py-4">
                            <i className="bi bi-graph-up fs-1 d-block mb-2"></i>
                            <p>{t("Create a budget to see analytics")}</p>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {/* Summary cards */}
                            <div className="col-md-3">
                                <div className="card text-center">
                                    <div className="card-body">
                                        <div className="text-muted small">{t("Planned")}</div>
                                        <div className="fw-bold fs-5">{(analytics.totalPlanned || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card text-center">
                                    <div className="card-body">
                                        <div className="text-muted small">{t("Actual")}</div>
                                        <div className="fw-bold fs-5">{(analytics.totalActual || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card text-center">
                                    <div className="card-body">
                                        <div className="text-muted small">{t("Variance")}</div>
                                        <div className={`fw-bold fs-5 ${analytics.variance < 0 ? 'text-danger' : 'text-success'}`}>
                                            {(analytics.variance || 0).toLocaleString()}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                            {(analytics.variancePercentage || 0).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="card text-center">
                                    <div className="card-body">
                                        <div className="text-muted small">{t("Funding Coverage")}</div>
                                        <div className={`fw-bold fs-5 ${analytics.fundingCoverage >= 100 ? 'text-success' : 'text-warning'}`}>
                                            {(analytics.fundingCoverage || 0).toFixed(0)}%
                                        </div>
                                        {analytics.fundingGap > 0 && (
                                            <div className="text-danger" style={{ fontSize: '0.7rem' }}>
                                                {t("Gap")}: {analytics.fundingGap.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Burn rate bar */}
                            <div className="col-12">
                                <div className="card">
                                    <div className="card-body">
                                        <h6>{t("Burn Rate")}</h6>
                                        <div className="progress" style={{ height: 24 }}>
                                            <div className={`progress-bar ${analytics.burnRate > 90 ? 'bg-danger' : analytics.burnRate > 70 ? 'bg-warning' : 'bg-success'}`}
                                                 style={{ width: `${Math.min(analytics.burnRate || 0, 100)}%` }}>
                                                {(analytics.burnRate || 0).toFixed(0)}%
                                            </div>
                                        </div>
                                        <div className="d-flex justify-content-between small text-muted mt-1">
                                            <span>{t("Actual")}: {(analytics.totalActual || 0).toLocaleString()}</span>
                                            <span>{t("Planned")}: {(analytics.totalPlanned || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Category breakdown */}
                            {analytics.actualByCategory && Object.keys(analytics.actualByCategory).length > 0 && (
                                <div className="col-12">
                                    <div className="card">
                                        <div className="card-body">
                                            <h6>{t("Actual by Category")}</h6>
                                            {Object.entries(analytics.actualByCategory).map(([cat, amount]) => (
                                                <div key={cat} className="d-flex justify-content-between small mb-1">
                                                    <span>{t(`finance.category.${cat}`)}</span>
                                                    <span className="fw-semibold">{amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
