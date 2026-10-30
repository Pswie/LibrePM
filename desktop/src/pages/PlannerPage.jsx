import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { librepm } from "@api/librepm.js";
import { toast } from "react-toastify";
import TaskEditorModal from "../components/TaskEditorModal.jsx";
import { useTranslation } from 'react-i18next';
import { useWorkflow } from "../context/WorkflowContext.jsx";
import { useModal } from "../hooks/useModal";
import ProjectRequired from '../components/ProjectRequired.jsx';

/**
 * PlannerPage - Vista lista per gestione task
 *
 * Features:
 * - Lista task ottimizzata
 * - Filtri e ricerca
 * - Creazione Task via modale completa (TaskEditorModal)
 * - Menu contestuale per azioni rapide (completa, elimina)
 * - Navigazione alle Note
 * - Menu contestuale Progetto (v0.4.2)
 *
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.8.0 - Integrazione TaskEditorModal e Note
 */

// ========================================
// PlannerPage Main Component
// ========================================

export default function PlannerPage({ shell }) {
    const { t } = useTranslation();
    const modal = useModal();
    const { getStatusByName } = useWorkflow();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPriority, setFilterPriority] = useState("");

    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    
    // Drag & Drop
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Setup shell header
    useEffect(() => {
        shell?.setTitle?.(t("Planner"));
        shell?.setHeaderActions?.(
            <div className="d-flex gap-2 align-items-center">
                <select
                    className="form-select form-select-sm"
                    value={shell?.currentProject?.id || "__SELECT__"}
                    onChange={(e) => {
                        if (e.target.value === "__SELECT__") {
                            shell?.navigate?.("menu");
                        } else {
                            const project = shell?.projects?.find(p => p.id === e.target.value);
                            shell?.setCurrentProject?.(project);
                        }
                    }}
                    style={{ width: 200 }}
                >
                    <option value="__SELECT__">{t("Select project...")}</option>
                    {shell?.projects?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t("Search...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 150 }}
                />

                <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                        setSelectedTask(null); // Null per nuovo task
                        setShowTaskModal(true);
                    }}
                    disabled={!shell?.currentProject}
                >
                    <i className="bi bi-plus-lg me-1"></i>
                    {t("Task")}
                </button>
            </div>
        );

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, searchTerm, t]);

    // Load tasks
    const loadTasks = useCallback(async () => {
        if (!shell?.currentProject) {
            setTasks([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const tasksList = await librepm.tasksList(shell.currentProject.id, {
                status: filterStatus || undefined,
                priority: filterPriority || undefined,
                search: searchTerm || undefined,
            });
            // Ensure sorting by order if provided by backend, otherwise default sort
            // Assuming backend returns tasks ordered by 'order' or creation date
            setTasks(tasksList || []);
        } catch (e) {
            toast.error(t("Error loading tasks") + ": " + e.message);
        } finally {
            setLoading(false);
        }
    }, [shell?.currentProject, filterStatus, filterPriority, searchTerm]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Handlers
    const handleSaveTask = async (taskData, uploadedFiles) => {
        if (!shell?.currentProject) return;
        try {
            let taskId = taskData.id;
            
            if (taskId) {
                await librepm.tasksUpdate(shell.currentProject.id, taskId, taskData);
                toast.success(t("Task updated"));
            } else {
                const created = await librepm.tasksCreate(shell.currentProject.id, taskData);
                taskId = created.id;
                toast.success(t("Task created"));
            }
            
            // Upload assets se presenti, collegandoli al task
            if (uploadedFiles && uploadedFiles.length > 0) {
                await librepm.assetsUploadMultiple(uploadedFiles, `Allegato Task: ${taskData.title}`, taskId);
            }

            setShowTaskModal(false);
            loadTasks();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!shell?.currentProject) return;
        const confirmed = await modal.confirm({
            title: t("Delete Task"),
            message: t("Are you sure you want to delete this task? This action is irreversible.")
        });
        if (!confirmed) return;
        try {
            await librepm.tasksDelete(shell.currentProject.id, taskId);
            toast.success(t("Task deleted"));
            setShowTaskModal(false);
            loadTasks();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };

    const handleSetStatus = async (taskId, statusName) => {
        if (!shell?.currentProject) return;
        const status = getStatusByName(statusName);
        if (!status) {
            toast.error(t("Error") + ": Status not found: " + statusName);
            return;
        }
        try {
            await librepm.tasksUpdateStatus(shell.currentProject.id, taskId, status.id);
            loadTasks();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };

    const handleOpenNotes = (task) => {
        shell?.navigate?.("notes", { taskId: task.id, projectId: shell.currentProject.id });
    };

    // Drag & Drop Handlers
    const handleDragStart = (e, index) => {
        dragItem.current = index;
    };

    const handleDragEnter = (e, index) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = async () => {
        // Correct check for null/undefined
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        
        const newTasks = [...tasks];
        const draggedItemContent = newTasks[dragItem.current];
        newTasks.splice(dragItem.current, 1);
        newTasks.splice(dragOverItem.current, 0, draggedItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        setTasks(newTasks);

        try {
            // Extract ordered IDs
            const orderedIds = newTasks.map(t => t.id);
            // This API call assumes backend supports reordering via a list of IDs
            // If backend support is missing, this call might fail or be a no-op until backend is implemented
            // However, requested feature is FE implementation first.
            await librepm.tasksReorder(shell.currentProject.id, orderedIds);
            toast.success(t("Order updated"));
        } catch (e) {
            // If API doesn't exist or fails, just toast error but keep FE state (optimistic) or revert?
            // Reverting would be safer but jarring. Let's keep optimistic for now but warn.
            console.error("Reorder failed", e);
            // toast.error(t("Error reordering tasks") + ": " + e.message);
            // loadTasks(); // Uncomment to revert on error
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;
    if (!shell?.currentProject) return <ProjectRequired shell={shell} />;

    return (
        <div className="planner-page h-100 p-3">
            <div className="list-group shadow-sm">
                {tasks.map((task, index) => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.statusName !== "DONE";
                    const checklistProgress = task.checklistItems?.length > 0
                        ? `${task.checklistItems.filter(i => i.done).length}/${task.checklistItems.length}`
                        : null;

                    return (
                        <div 
                            key={task.id} 
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${isOverdue ? "border-danger" : ""}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            style={{ cursor: "grab" }}
                        >
                            <div className="text-muted pe-2 cursor-grab" title={t("Drag to reorder")}>
                                <i className="bi bi-grip-vertical"></i>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={task.statusName === "DONE"}
                                    onChange={() => handleSetStatus(task.id, task.statusName === "DONE" ? "TODO" : "DONE")}
                                />
                            </div>
                            <div className="flex-grow-1" onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} style={{ cursor: "pointer" }}>
                                <div className="d-flex align-items-center gap-2">
                                    <span className={`fw-bold ${task.statusName === "DONE" ? "text-decoration-line-through text-muted" : ""}`}>
                                        {task.title}
                                    </span>
                                    {isOverdue && <span className="badge bg-danger">{t("Overdue").toUpperCase()}</span>}
                                    <span
                                        className="badge scale-75"
                                        style={{ backgroundColor: task.priorityColor || "#6c757d", color: "white" }}
                                    >
                                        {task.priorityName || "N/A"}
                                    </span>
                                </div>
                                <div className="small text-muted d-flex gap-3 mt-1">
                                    {task.deadline && (
                                        <span><i className="bi bi-calendar3 me-1"></i>{new Date(task.deadline).toLocaleDateString()}</span>
                                    )}
                                    {task.owner && (
                                        <span><i className="bi bi-person me-1"></i>{task.owner}</span>
                                    )}
                                    {task.assignedTo && (
                                        <span><i className="bi bi-person-check me-1"></i>{task.assignedTo.displayName || task.assignedTo.username}</span>
                                    )}
                                    {checklistProgress && (
                                        <span><i className="bi bi-check2-square me-1"></i>{checklistProgress}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleOpenNotes(task); }}
                                title={t("Open Notes")}
                            >
                                <i className="bi bi-journal-text me-1"></i>
                                {t("Notes")}
                            </button>
                            <div className="dropdown">
                                <button className="btn btn-sm btn-link text-muted" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                    <li><button className="dropdown-item" onClick={() => handleSetStatus(task.id, task.statusName === "DONE" ? "TODO" : "DONE")}>{task.statusName === "DONE" ? t("Reopen") : t("Mark as complete")}</button></li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li><button className="dropdown-item text-danger" onClick={() => handleDeleteTask(task.id)}>{t("Delete Task")}</button></li>
                                </ul>
                            </div>
                        </div>
                    );
                })}
                {tasks.length === 0 && (
                    <div className="list-group-item text-center text-muted py-5">
                        {t("No tasks found. Click on '+ Task' to create one.")}
                    </div>
                )}
            </div>

            {shell?.currentProject && (
                <TaskEditorModal
                    show={showTaskModal}
                    onHide={() => setShowTaskModal(false)}
                    task={selectedTask}
                    projectId={shell.currentProject.id}
                    onSave={handleSaveTask}
                    onNavigateToNote={(note) => shell.navigate('notes', { noteId: note.id })}
                />
            )}
        </div>
    );
}
