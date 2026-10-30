import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { librepm } from '@api/librepm.js';
import { toast } from 'react-toastify';
import { useModal } from '../hooks/useModal.js';
import SuiteProjectsPanel from '../components/SuiteProjectsPanel.jsx';

/**
 * IntegrationsPage - Manage Import/Export and external connections like ICS.
 */
export default function IntegrationsPage({ shell }) {
    const { t } = useTranslation();
    const modal = useModal();
    const [icsToken, setIcsToken] = useState('');
    const [loadingToken, setLoadingToken] = useState(true);
    const [tokenError, setTokenError] = useState('');
    const [mappingProfiles, setMappingProfiles] = useState([]);
    const isDesktop = librepm.isElectron();

    const loadIcsToken = useCallback(async () => {
        setLoadingToken(true);
        setTokenError('');
        try {
            const response = await librepm.getCalendarToken();
            if (!response?.token) throw new Error('Calendar token unavailable');
            setIcsToken(response.token);
        } catch (error) {
            setIcsToken('');
            setTokenError(error.message);
        } finally { setLoadingToken(false); }
    }, []);

    const loadMappingProfiles = useCallback(async () => {
        try {
            const profiles = await librepm.importMappingProfilesList();
            setMappingProfiles(profiles || []);
        } catch (e) {
            console.error("Error loading mapping profiles", e);
        }
    }, []);

    useEffect(() => {
        shell?.setTitle?.(t("Integrations"));
        shell?.setHeaderActions?.(
            <div className="d-flex gap-2 align-items-center">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={loadIcsToken}
                    title={t("Refresh")}
                >
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        );
        loadIcsToken();
        loadMappingProfiles();

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, t, loadMappingProfiles, loadIcsToken]);

    const handleRegenerateToken = async () => {
        const confirmed = await modal.confirm({ title: t("Are you sure you want to regenerate the token?") });
        if (!confirmed) return;
        setLoadingToken(true);
        try {
            const response = await librepm.regenerateCalendarToken();
            setIcsToken(response.token);
            setTokenError('');
            toast.success(t("Token regenerated successfully"));
        } catch (e) {
            toast.error(t("Error regenerating token"));
        } finally { setLoadingToken(false); }
    };

    const handleExport = async (format) => {
        try {
            if ((!isDesktop || format === 'csv') && !shell.currentProject) {
                toast.warn(t('Select a project'));
                return;
            }
            
            if (librepm.isElectron()) {
                if (format === 'json') await librepm.exportJsonDialog();
                if (format === 'csv') await librepm.exportCsvDialog(shell.currentProject.id);
            } else {
                const blob = await librepm.exportProject(shell.currentProject.id, format);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `librepm-project-${shell.currentProject.id}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (e) {
            toast.error(`${t("Export failed")}: ${e.message}`);
        }
    };

    const handleImport = async () => {
        const confirmed = await modal.confirm({ title: t("Warning: Importing will overwrite existing data. Continue?") });
        if (!confirmed) return;
        
        if (librepm.isElectron()) {
            await librepm.importJsonDialog();
        } else {
            // Basic web file input for import
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = ".json,.zip";
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await librepm.importDatabase(file);
                        toast.success(t("Import successful! Restarting..."));
                        setTimeout(() => window.location.reload(), 2000);
                    } catch (err) {
                        toast.error(`${t("Import failed")}: ${err.message}`);
                    }
                }
            };
            input.click();
        }
    };

    const icsUrl = icsToken ? `${librepm.getApiUrl()}/public/calendar/${encodeURIComponent(icsToken)}/feed.ics` : '';

    return (
        <div className="container-fluid p-4">
            <h4 className="mb-4">{t("Integrations & Data")}</h4>
            <SuiteProjectsPanel shell={shell} />

            {/* ICS Calendar Feed */}
            <div className="card shadow-sm mb-4">
                <div className="card-header">
                    <h5 className="mb-0">{t("External Calendar (iCal)")}</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">{t("Use this link to sync your tasks with Google Calendar, Outlook or Apple Calendar.")}</p>
                    {loadingToken ? (
                        <div className="spinner-border spinner-border-sm"></div>
                    ) : tokenError ? <div className="alert alert-warning mb-0" role="alert">{tokenError}<button className="btn btn-sm btn-outline-secondary ms-2" onClick={loadIcsToken}>{t('Retry')}</button></div> : (
                        <div className="input-group">
                            <input type="text" className="form-control" aria-label={t('External Calendar (iCal)')} value={icsUrl} readOnly />
                            <button className="btn btn-outline-secondary" aria-label={t('Copied to clipboard')} onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(icsUrl);
                                    toast.success(t('Copied to clipboard'));
                                } catch (error) { toast.error(`${t('Error')}: ${error.message}`); }
                            }}>
                                <i className="bi bi-clipboard"></i>
                            </button>
                        </div>
                    )}
                </div>
                <div className="card-footer bg-light">
                    <button className="btn btn-sm btn-outline-secondary" disabled={loadingToken} onClick={handleRegenerateToken}>
                        {t("Regenerate Token")}
                    </button>
                </div>
            </div>

            {/* Import / Export */}
            <div className="card shadow-sm mb-4">
                <div className="card-header">
                    <h5 className="mb-0">{t("Import / Export Data")}</h5>
                </div>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <h6>{t("Export")}</h6>
                            <p className="small text-muted">{t("Export your data in various formats.")}</p>
                            <div className="d-flex gap-2">
                                <button className="btn btn-primary" disabled={!isDesktop && !shell.currentProject} onClick={() => handleExport('json')}>
                                    <i className="bi bi-box-arrow-down me-2"></i>{t(isDesktop ? 'Export JSON' : 'Export JSON (Project)')}
                                </button>
                                <button className="btn btn-secondary" onClick={() => handleExport('csv')} disabled={!shell.currentProject}>
                                    <i className="bi bi-file-earmark-spreadsheet me-2"></i>{t("Export CSV (Project)")}
                                </button>
                            </div>
                        </div>
                        {isDesktop && <div className="col-md-6">
                            <h6>{t("Import")}</h6>
                            <p className="small text-muted">{t("Import data from a JSON backup. This will overwrite current data.")}</p>
                            <button className="btn btn-danger" onClick={handleImport}>
                                <i className="bi bi-box-arrow-in-up me-2"></i>{t("Import JSON")}
                            </button>
                        </div>}
                    </div>
                </div>
            </div>

            {/* Mapping Profiles */}
            <div className="card shadow-sm">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">{t("Import Mapping Profiles")}</h5>
                </div>
                <div className="card-body">
                    <p className="small text-muted">{t("Saved column mapping profiles for CSV imports.")}</p>
                    {mappingProfiles.length === 0 ? (
                        <p className="text-muted fst-italic">{t("No mapping profiles saved yet.")}</p>
                    ) : (
                        <table className="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>{t("Name")}</th>
                                    <th>{t("Entity Type")}</th>
                                    <th>{t("Created")}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappingProfiles.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td><span className="badge bg-secondary">{p.entityType}</span></td>
                                        <td className="small text-muted">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                                                const confirmed = await modal.confirm({ title: t("Delete this mapping profile?") });
                                                if (!confirmed) return;
                                                try {
                                                    await librepm.importMappingProfilesDelete(p.id);
                                                    toast.success(t("Profile deleted"));
                                                    loadMappingProfiles();
                                                } catch (e) {
                                                    toast.error(t("Error deleting profile"));
                                                }
                                            }}>
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
