import { useState, useEffect, useCallback, useRef } from "react";
import { librepm } from "@api/librepm.js";
import { toast } from "react-toastify";
import ProjectDetailModal from "../components/ProjectDetailModal.jsx";
import Modal from "../components/Modal.jsx";
import { useTranslation } from 'react-i18next';
import { useModal } from "../hooks/useModal.js";
import { summarizeProjectTasks } from '../utils/projectPresentation.js';

/**
 * MenuPage - Lista Progetti
 *
 * Features:
 * - Lista progetti con stato salute (PRD-05)
 * - Creazione rapida progetto
 * - Statistiche per progetto
 * - Filtro progetti archiviati
 * - Azioni rapide (Archivia, Elimina)
 * - Dettaglio Progetto (v0.5.1)
 *
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.5.1 - Integrazione ProjectDetailModal
 */
export default function MenuPage({ shell }) {
    const { t } = useTranslation();
    const modal = useModal();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDesc, setNewProjectDesc] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const requestVersion = useRef(0);

    // Setup shell
    useEffect(() => {
        shell?.setTitle?.(t("Projects"));
        shell?.setHeaderActions?.(
            <div className="d-flex gap-2 align-items-center">
                <div className="form-check form-switch mb-0 me-2">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="showArchived"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="showArchived">{t("Archived projects")}</label>
                </div>
                <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowNewProjectModal(true)}
                >
                    <i className="bi bi-plus-lg me-1"></i>
                    {t("New Project")}
                </button>
            </div>
        );
        shell?.setRightPanel?.(null);

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, showArchived, t]);

    // Handle Nav Actions (e.g. from Command Palette)
    useEffect(() => {
        if (shell?.navAction === "openNewProjectModal") {
            setShowNewProjectModal(true);
            shell.clearNavAction();
        }
    }, [shell?.navAction, shell]);

    // Carica dati
    const loadData = useCallback(async () => {
        const request = ++requestVersion.current;
        try {
            setLoading(true);
            setLoadError('');

            const list = await librepm.projectsList({ archived: showArchived });

            // Arricchisci con statistiche
            const enriched = await Promise.all(list.map(async (p) => {
                try {
                    const tasks = await librepm.tasksList(p.id);
                    const stats = summarizeProjectTasks(tasks);
                    const { overdue } = stats;

                    let health = "OK";
                    if (overdue > 3) health = "CRITICAL";
                    else if (overdue > 0) health = "WARNING";

                    return { ...p, stats, health };
                } catch (e) {
                    return { ...p, stats: null };
                }
            }));

            if (requestVersion.current === request) setProjects(enriched);

        } catch (e) {
            if (requestVersion.current === request) setLoadError(e.message || t("Error loading"));
        } finally {
            if (requestVersion.current === request) setLoading(false);
        }
    }, [showArchived, t]);

    useEffect(() => {
        loadData();
        return () => { requestVersion.current += 1; };
    }, [loadData]);

    const handleCreateProject = async () => {
        if (!newProjectName.trim() || saving) return;
        setSaving(true);
        try {
            await shell.createProject(newProjectName.trim(), newProjectDesc.trim());
            setNewProjectName("");
            setNewProjectDesc("");
            setShowNewProjectModal(false);
            toast.success(t("Success"));
            loadData();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        } finally { setSaving(false); }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            await shell?.deleteProject?.(projectId);
            toast.success(t("Deleted successfully"));
            setSelectedProject(null); // Close modal if open
            loadData();
        } catch (e) {
            toast.error(t("Deletion error") + ": " + e.message);
        }
    };

    const handleUpdateProject = async (projectId, data) => {
        const updated = await librepm.projectsUpdate(projectId, data);
        if (shell.currentProject?.id === projectId) shell.setCurrentProject(updated);
        await shell.refreshProjects?.();
        loadData();
        setSelectedProject(prev => ({ ...prev, ...updated }));
    };

    const handleArchiveProject = async (project) => {
        const newStatus = !project.archived;
        
        try {
            await librepm.projectsSetArchived(project.id, newStatus);
            await shell.refreshProjects?.();
            toast.success(t("Success"));
            loadData();
            if (selectedProject?.id === project.id) {
                setSelectedProject(prev => ({ ...prev, archived: newStatus }));
            }
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };

    const handleNavigateToPlanner = (project) => {
        shell?.setCurrentProject?.(project);
        shell?.navigate?.("planner");
    };

    const handleNavigateToNotes = (note) => {
        shell?.setCurrentProject?.(selectedProject);
        shell?.navigate?.("notes", { projectId: selectedProject.id, noteId: note?.id });
    };

    if (loading) return <div className="d-flex justify-content-center align-items-center gap-3 py-5" role="status"><div className="spinner-border text-primary" aria-hidden="true"></div><span>{t('Loading projects...')}</span></div>;

    const visibleProjects = projects.filter(project => `${project.name} ${project.description || ''}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="menu-page container-fluid py-3 px-0">
            <div className="mb-4 d-flex flex-wrap align-items-end justify-content-between gap-3">
                <div><h2 className="h4 mb-1">{showArchived ? t('Archived projects') : t('Projects')}</h2><p className="text-muted small mb-0">{t('Choose a project to open its plan, team and funding.')}</p></div>
                <div className="jl-project-search"><label className="visually-hidden" htmlFor="project-search">{t('Search projects')}</label><input id="project-search" className="form-control" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search projects')} /></div>
            </div>
            {loadError ? <div className="alert alert-danger" role="alert"><p>{t('Could not load projects.')} {loadError}</p><button className="btn btn-outline-danger" onClick={loadData}>{t('Retry')}</button></div> : visibleProjects.length === 0 ? (
                <div className="text-center py-5">
                    <i className="bi bi-folder2-open fs-1 text-muted d-block mb-3"></i>
                    <h5 className="text-muted">{search ? t('No projects match your search.') : showArchived ? t("No archived projects") : t("No active projects")}</h5>
                    {search ? <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>{t('Clear search')}</button> : !showArchived && (
                        <>
                            <p className="text-muted small mb-3">{t("Start by creating your first project.")}</p>
                            <button className="btn btn-primary" onClick={() => setShowNewProjectModal(true)}>
                                <i className="bi bi-plus-lg me-2"></i>{t("Create Project")}
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="row g-3">
                    {visibleProjects.map((project) => (
                        <div key={project.id} className="col-md-6 col-xxl-4">
                            <div className={`card h-100 shadow-sm project-card ${project.health === 'CRITICAL' ? 'border-danger' : project.health === 'WARNING' ? 'border-warning' : ''} ${project.archived ? 'bg-light' : ''}`}>
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex flex-nowrap justify-content-between align-items-start gap-2 mb-2">
                                        <h5 className={`card-title mb-0 ${project.archived ? 'text-muted text-decoration-line-through' : ''}`} style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                                            {project.archived && <i className="bi bi-archive-fill me-2"></i>}
                                            {project.name}
                                        </h5>
                                        <div className="dropdown flex-shrink-0">
                                            <button className="btn btn-link btn-sm text-muted" data-bs-toggle="dropdown" aria-expanded="false" aria-label={`${t('Project actions')}: ${project.name}`}>
                                                <i className="bi bi-three-dots-vertical"></i>
                                            </button>
                                            <ul className="dropdown-menu dropdown-menu-end">
                                                <li>
                                                    <button className="dropdown-item" onClick={() => handleArchiveProject(project)}>
                                                        <i className={`bi ${project.archived ? 'bi-arrow-counterclockwise' : 'bi-archive'} me-2`}></i>
                                                        {project.archived ? t('Reopen') : t('Archive')}
                                                    </button>
                                                </li>
                                                <li><hr className="dropdown-divider" /></li>
                                                <li>
                                                    <button className="dropdown-item text-danger" onClick={async () => {
                                                        const confirmed = await modal.confirm({ title: t("Delete project?") });
                                                        if (confirmed) handleDeleteProject(project.id);
                                                    }}>
                                                        <i className="bi bi-trash me-2"></i>
                                                        {t("Delete")}
                                                    </button>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <p className="card-text text-muted small mb-3 flex-grow-1" style={{ minHeight: 40 }}>
                                        {project.description || t("No content")}
                                    </p>

                                    <div className="d-flex justify-content-between align-items-center mb-3 small">
                                        <span className="text-muted">
                                            <i className="bi bi-list-check me-1"></i>
                                            {project.stats ? `${project.stats.done}/${project.stats.total} ${t('Task')}` : t('Statistics unavailable')}
                                        </span>
                                        {!project.archived && project.stats?.overdue > 0 && (
                                            <span className="text-danger fw-bold">
                                                <i className="bi bi-exclamation-triangle me-1"></i>
                                                {project.stats.overdue} {t("Late")}
                                            </span>
                                        )}
                                    </div>

                                    {project.stats && <div className="progress" role="progressbar" aria-label={t('Completion')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.stats.total > 0 ? Math.round(project.stats.done / project.stats.total * 100) : 0} style={{ height: 6 }}>
                                        <div
                                            className={`progress-bar ${project.health === 'CRITICAL' ? 'bg-danger' : 'bg-primary'}`}
                                            style={{ width: `${project.stats.total > 0 ? (project.stats.done / project.stats.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>}

                                    <button
                                        className="btn btn-outline-primary btn-sm w-100 mt-3"
                                        onClick={() => setSelectedProject(project)}
                                    >
                                        {t("Project Detail")}
                                    </button>
                                    {!project.archived && <button className="btn btn-primary btn-sm w-100 mt-2" onClick={() => handleNavigateToPlanner(project)}>{t('Open Project')} <i className="bi bi-arrow-right ms-1" aria-hidden="true"></i></button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Project Modal */}
            {showNewProjectModal && (
                <Modal onClose={() => { if (!saving) setShowNewProjectModal(false); }}>
                    <form onSubmit={event => { event.preventDefault(); handleCreateProject(); }}>
                    <div className="modal-header">
                        <h5 className="modal-title">{t("New Project")}</h5>
                        <button
                            type="button"
                            className="btn-close"
                            aria-label={t('Close')}
                            disabled={saving}
                            onClick={() => setShowNewProjectModal(false)}
                        ></button>
                    </div>
                    <div className="modal-body">
                        <div className="mb-3">
                            <label htmlFor="new-project-name" className="form-label">{t("Title")}</label>
                            <input
                                type="text"
                                id="new-project-name"
                                required
                                maxLength={200}
                                className="form-control"
                                placeholder={t('For example: Community support')}
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="new-project-description" className="form-label">{t("Description")}</label>
                            <textarea
                                className="form-control"
                                id="new-project-description"
                                maxLength={2000}
                                rows="3"
                                placeholder={t("Description...")}
                                value={newProjectDesc}
                                onChange={(e) => setNewProjectDesc(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={saving}
                            onClick={() => setShowNewProjectModal(false)}
                        >
                            {t("Cancel")}
                        </button>
                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={!newProjectName.trim() || saving}
                        >
                            {saving ? t('Saving...') : t("Create")}
                        </button>
                    </div>
                    </form>
                </Modal>
            )}

            {/* Project Detail Modal */}
            {selectedProject && (
                <ProjectDetailModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onUpdate={handleUpdateProject}
                    onDelete={handleDeleteProject}
                    onArchive={handleArchiveProject}
                    onNavigateToPlanner={handleNavigateToPlanner}
                    onNavigateToNotes={handleNavigateToNotes}
                />
            )}
        </div>
    );
}
