import { useState, useEffect, useCallback } from "react";
import { librepm } from "@api/librepm.js";
import { toast } from "react-toastify";
import ProjectDetailModal from "../components/ProjectDetailModal.jsx";
import Modal from "../components/Modal.jsx";
import { useTranslation } from 'react-i18next';
import { useModal } from "../hooks/useModal.js";

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
                    <label className="form-check-label small" htmlFor="showArchived">{t("Show archived")}</label>
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
        try {
            setLoading(true);

            const list = await librepm.projectsList({ archived: showArchived });

            // Arricchisci con statistiche
            const enriched = await Promise.all(list.map(async (p) => {
                try {
                    const tasks = await librepm.tasksList(p.id);
                    const total = tasks.length;
                    const done = tasks.filter(t => t.status === "DONE").length;
                    const overdue = tasks.filter(t => {
                        if (!t.deadline || t.status === 'DONE') return false;
                        return new Date(t.deadline) < new Date();
                    }).length;

                    let health = "OK";
                    if (overdue > 3) health = "CRITICAL";
                    else if (overdue > 0) health = "WARNING";

                    return { ...p, stats: { total, done, overdue }, health };
                } catch (e) {
                    return { ...p, stats: { total: 0, done: 0, overdue: 0 }, health: "OK" };
                }
            }));

            setProjects(enriched);

        } catch (e) {
            toast.error(t("Error loading"));
        } finally {
            setLoading(false);
        }
    }, [showArchived, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            await shell?.createProject?.(newProjectName, newProjectDesc);
            setNewProjectName("");
            setNewProjectDesc("");
            setShowNewProjectModal(false);
            toast.success(t("Success"));
            loadData();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
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
        await librepm.projectsUpdate(projectId, data);
        loadData();
        setSelectedProject(prev => ({ ...prev, ...data }));
    };

    const handleArchiveProject = async (project) => {
        const newStatus = !project.archived;
        
        try {
            await librepm.projectsSetArchived(project.id, newStatus);
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
        shell?.navigate?.("notes", { projectId: selectedProject.id, noteId: note?.id });
    };

    if (loading) return <div className="d-flex justify-content-center align-items-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="menu-page container-fluid py-3">
            {projects.length === 0 ? (
                <div className="text-center py-5">
                    <i className="bi bi-folder2-open fs-1 text-muted d-block mb-3"></i>
                    <h5 className="text-muted">{showArchived ? t("No archived projects") : t("No active projects")}</h5>
                    {!showArchived && (
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
                    {projects.map((project) => (
                        <div key={project.id} className="col-md-6 col-lg-4">
                            <div className={`card h-100 shadow-sm project-card ${project.health === 'CRITICAL' ? 'border-danger' : project.health === 'WARNING' ? 'border-warning' : ''} ${project.archived ? 'bg-light' : ''}`}>
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <h5 className={`card-title mb-0 text-truncate ${project.archived ? 'text-muted text-decoration-line-through' : ''}`} title={project.name}>
                                            {project.archived && <i className="bi bi-archive-fill me-2"></i>}
                                            {project.name}
                                        </h5>
                                        <div className="dropdown">
                                            <button className="btn btn-link btn-sm p-0 text-muted" data-bs-toggle="dropdown" aria-expanded="false">
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
                                            {project.stats.done}/{project.stats.total} {t("Task")}
                                        </span>
                                        {!project.archived && project.stats.overdue > 0 && (
                                            <span className="text-danger fw-bold">
                                                <i className="bi bi-exclamation-triangle me-1"></i>
                                                {project.stats.overdue} {t("Late")}
                                            </span>
                                        )}
                                    </div>

                                    <div className="progress" style={{ height: 6 }}>
                                        <div
                                            className={`progress-bar ${project.health === 'CRITICAL' ? 'bg-danger' : 'bg-primary'}`}
                                            style={{ width: `${project.stats.total > 0 ? (project.stats.done / project.stats.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>

                                    <button
                                        className="btn btn-outline-primary btn-sm w-100 mt-3"
                                        onClick={() => setSelectedProject(project)}
                                        disabled={project.archived}
                                    >
                                        {t("Open Project")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Project Modal */}
            {showNewProjectModal && (
                <Modal onClose={() => setShowNewProjectModal(false)}>
                    <div className="modal-header">
                        <h5 className="modal-title">{t("New Project")}</h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setShowNewProjectModal(false)}
                        ></button>
                    </div>
                    <div className="modal-body">
                        <div className="mb-3">
                            <label className="form-label">{t("Title")}</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Es. Marketing Q4"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">{t("Description")}</label>
                            <textarea
                                className="form-control"
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
                            onClick={() => setShowNewProjectModal(false)}
                        >
                            {t("Cancel")}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreateProject}
                            disabled={!newProjectName.trim()}
                        >
                            {t("Create")}
                        </button>
                    </div>
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
