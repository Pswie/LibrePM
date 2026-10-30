import { useState, useEffect, useCallback, useMemo } from "react";
import { librepm } from "@api/librepm.js";
import { toast } from "react-toastify";
import { useTranslation } from 'react-i18next';
import { useWorkflow } from "../context/WorkflowContext.jsx";
import TaskEditorModal from "../components/TaskEditorModal.jsx";
import { useModal } from "../hooks/useModal.js";
import ProjectRequired from '../components/ProjectRequired.jsx';

/**
 * KanbanPage - Vista Kanban per gestione task
 *
 * Features:
 * - Dynamic columns from backend TaskStatus entities
 * - Drag and drop tra colonne
 * - Quick actions sui task
 * - Filtri e ricerca
 * - Integrazione Focus Timer con spostamento automatico (PRD-04)
 * - Badge progresso checklist (PRD-09)
 *
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.11.0 - Dynamic status columns from BE
 */

// ========================================
// Utility
// ========================================

function isLightColor(hex) {
    if (!hex) return false;
    const c = hex.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

const STATUS_ICONS = {
    "TODO": "bi-circle",
    "IN_PROGRESS": "bi-play-circle",
    "DONE": "bi-check-circle",
    "REVIEW": "bi-eye",
    "BLOCKED": "bi-x-circle",
};

// ========================================
// KanbanCard Component
// ========================================

function KanbanCard({ task, onStatusChange, onEdit, onDelete, onTimerToggle, runningTimers, t }) {
    const [isDragging, setIsDragging] = useState(false);

    const priorityBg = task.priorityColor || "#6c757d";
    const priorityText = isLightColor(priorityBg) ? "black" : "white";

    const handleDragStart = (e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.setData("currentStatusId", task.statusId);
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.statusName !== "DONE";
    const isTimerRunningOnThis = runningTimers.has(task.id);
    const checklistProgress = task.checklistItems?.length > 0
        ? `${task.checklistItems.filter(i => i.done).length}/${task.checklistItems.length}`
        : null;

    return (
        <div
            className={`kanban-card card mb-2 shadow-sm ${isDragging ? "dragging" : ""} ${isTimerRunningOnThis ? "border-success" : ""}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            style={{
                cursor: "grab",
                opacity: isDragging ? 0.5 : 1,
                borderLeft: `4px solid ${priorityBg}`,
                borderRight: isTimerRunningOnThis ? `4px solid #198754` : 'none',
            }}
        >
            <div className="card-body p-2">
                {/* Header con titolo e azioni */}
                <div className="d-flex justify-content-between align-items-start mb-1">
                    <h6 className="card-title mb-0 flex-grow-1" style={{ fontSize: "0.9rem" }}>
                        {task.title}
                    </h6>
                    <div className="dropdown">
                        <button
                            className="btn btn-sm btn-link text-muted p-0"
                            type="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                        >
                            <i className="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                                <button className="dropdown-item" onClick={() => onEdit(task)}>
                                    <i className="bi bi-pencil me-2"></i>{t("Edit")}
                                </button>
                            </li>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                                <button className="dropdown-item text-danger" onClick={() => onDelete(task)}>
                                    <i className="bi bi-trash me-2"></i>{t("Delete")}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Descrizione (troncata) */}
                {task.description && (
                    <p className="card-text text-muted small mb-2" style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                    }}>
                        {task.description}
                    </p>
                )}

                {/* Footer con metadata */}
                <div className="d-flex justify-content-between align-items-center">
                    {/* Priorità e Checklist */}
                    <div className="d-flex align-items-center gap-2">
                        <span
                            className="badge"
                            style={{
                                backgroundColor: priorityBg,
                                color: priorityText,
                                fontSize: "0.7rem",
                            }}
                        >
                            {task.priorityName || "N/A"}
                        </span>
                        {checklistProgress && (
                            <span className="badge bg-light text-dark border">
                                <i className="bi bi-check2-square me-1"></i>
                                {checklistProgress}
                            </span>
                        )}
                    </div>

                    {/* Deadline */}
                    {task.deadline && (
                        <span className={`small ${isOverdue ? "text-danger fw-bold" : "text-muted"}`}>
                            <i className={`bi ${isOverdue ? "bi-exclamation-triangle" : "bi-calendar"} me-1`}></i>
                            {new Date(task.deadline).toLocaleDateString("it-IT", {
                                day: "2-digit",
                                month: "short",
                            })}
                        </span>
                    )}

                    {/* Focus Timer Button */}
                    <button
                        className={`btn btn-sm p-1 ${isTimerRunningOnThis ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => onTimerToggle(task)}
                        title={isTimerRunningOnThis ? t("Stop timer") : t("Start timer")}
                    >
                        <i className={`bi ${isTimerRunningOnThis ? "bi-stop-fill" : "bi-play-fill"}`}></i>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ========================================
// KanbanColumn Component
// ========================================

function KanbanColumn({ column, tasks, onDrop, onEdit, onDelete, onStatusChange, onTimerToggle, runningTimers, t }) {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);

        const taskId = e.dataTransfer.getData("taskId");
        const currentStatusId = e.dataTransfer.getData("currentStatusId");

        if (currentStatusId !== column.id) {
            onDrop(taskId, column.id);
        }
    };

    return (
        <div
            className={`kanban-column flex-grow-1 ${isDragOver ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                minWidth: 280,
                maxWidth: 400,
                backgroundColor: "#f1f2f4",
                borderRadius: "8px",
                transition: "background-color 0.2s",
            }}
        >
            {/* Column Header */}
            <div
                className="kanban-column-header p-2 rounded-top"
                style={{
                    backgroundColor: column.color,
                    color: "white",
                }}
            >
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold">
                        <i className={`bi ${column.icon} me-2`}></i>
                        {column.label}
                    </span>
                    <span className="badge bg-light text-dark">{tasks.length}</span>
                </div>
            </div>

            {/* Column Body */}
            <div
                className="kanban-column-body p-2"
                style={{
                    minHeight: 400,
                    maxHeight: "calc(100vh - 250px)",
                    overflowY: "auto",
                }}
            >
                {tasks.length === 0 ? (
                    <div className="text-center text-muted py-4">
                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                        <small>{t("No tasks")}</small>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <KanbanCard
                            key={task.id}
                            task={task}
                            onStatusChange={onStatusChange}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onTimerToggle={onTimerToggle}
                            runningTimers={runningTimers}
                            t={t}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ========================================
// KanbanPage Main Component
// ========================================

export default function KanbanPage({ shell }) {
    const { t } = useTranslation();
    const { statuses, getStatusByName } = useWorkflow();
    const modal = useModal();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    // Multi-timer: Map<taskId, session>
    const [runningTimers, setRunningTimers] = useState(new Map());
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Build columns dynamically from BE statuses
    const COLUMNS = useMemo(() =>
        statuses.map(s => ({
            id: s.id,
            name: s.name,
            label: t(s.name === "IN_PROGRESS" ? "In Progress" : s.name === "TODO" ? "To Do" : s.name === "DONE" ? "Done" : s.name === "BLOCKED" ? "Blocked" : s.name === "REVIEW" ? "Review" : s.name === "CANCELLED" ? "Cancelled" : s.name),
            color: s.color || "#6c757d",
            icon: STATUS_ICONS[s.name] || "bi-circle",
        })),
    [statuses, t]);

    // Setup shell
    useEffect(() => {
        shell?.setTitle?.(t("Kanban"));
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
                    placeholder={t("Search tasks...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 200 }}
                />
                <button
                    className="btn btn-sm btn-primary"
                    onClick={() => { setSelectedTask(null); setShowTaskModal(true); }}
                    disabled={!shell?.currentProject}
                >
                    <i className="bi bi-plus-lg me-1"></i>
                    {t("Task")}
                </button>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={loadTasks}
                    title={t("Refresh")}
                >
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        );

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, searchTerm, filterPriority, t]);

    // Load Tasks & Timer
    const loadTasks = useCallback(async () => {
        if (!shell?.currentProject) {
            setTasks([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [tasksList, timers] = await Promise.all([
                librepm.tasksList(shell.currentProject.id),
                librepm.focusRunningAll().catch(() => [])
            ]);
            setTasks(tasksList || []);
            // Build Map<taskId, session> from running timers
            const timerMap = new Map();
            (timers || []).forEach(s => { if (s.taskId) timerMap.set(s.taskId, s); });
            setRunningTimers(timerMap);
        } catch (e) {
            console.error("[KanbanPage] Errore caricamento:", e);
            toast.error(t("Error loading") + ": " + e.message);
        } finally {
            setLoading(false);
        }
    }, [shell?.currentProject, t]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Filtered Tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            if (searchTerm && !task.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterPriority && task.priorityName !== filterPriority) return false;
            if (task.archived) return false;
            return true;
        });
    }, [tasks, searchTerm, filterPriority]);

    // Group Tasks by Status (column.id is the status UUID, task.statusId matches)
    const tasksByColumn = useMemo(() => {
        const grouped = {};
        COLUMNS.forEach((col) => {
            grouped[col.id] = filteredTasks.filter((t) => t.statusId === col.id);
        });
        return grouped;
    }, [filteredTasks, COLUMNS]);

    // Handlers
    const handleDrop = async (taskId, newStatusId) => {
        if (!shell?.currentProject) return;
        try {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, statusId: newStatusId } : t)));
            await librepm.tasksUpdateStatus(shell.currentProject.id, taskId, newStatusId);
            toast.success(`${t("Task moved to")} "${COLUMNS.find(c => c.id === newStatusId)?.label}"`);
        } catch (e) {
            toast.error(t("Update error") + ": " + e.message);
            loadTasks();
        }
    };

    const handleTimerToggle = async (task) => {
        try {
            if (runningTimers.has(task.id)) {
                const session = runningTimers.get(task.id);
                await librepm.focusStop(session.id);
                setRunningTimers(prev => {
                    const next = new Map(prev);
                    next.delete(task.id);
                    return next;
                });
                toast.info(t("Timer stopped"));
            } else {
                const newTimer = await librepm.focusStart(task.id);
                setRunningTimers(prev => {
                    const next = new Map(prev);
                    next.set(task.id, newTimer);
                    return next;
                });
                toast.success(t("Timer started on") + ": " + task.title);

                // Automatically move to "IN_PROGRESS" if not already
                if (task.statusName !== "IN_PROGRESS") {
                    const inProgressStatus = getStatusByName("IN_PROGRESS");
                    if (inProgressStatus) {
                        handleDrop(task.id, inProgressStatus.id);
                    }
                }
            }
        } catch (e) {
            toast.error(t("Timer error") + ": " + e.message);
        }
    };

    const handleEdit = (task) => { setSelectedTask(task); setShowTaskModal(true); };

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
            if (uploadedFiles && uploadedFiles.length > 0) {
                await librepm.assetsUploadMultiple(uploadedFiles, `Allegato Task: ${taskData.title}`, taskId);
            }
            setShowTaskModal(false);
            loadTasks();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };
    const handleDelete = async (task) => {
        if (!shell?.currentProject) return;
        const confirmed = await modal.confirm({ title: `${t("Delete")} "${task.title}"?` });
        if (!confirmed) return;
        try {
            await librepm.tasksDelete(shell.currentProject.id, task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            toast.success(t("Task deleted"));
        } catch (e) {
            toast.error(t("Deletion error") + ": " + e.message);
        }
    };

    if (loading) return <div className="d-flex justify-content-center align-items-center py-5"><div className="spinner-border text-primary"></div></div>;
    if (!shell?.currentProject) return <ProjectRequired shell={shell} />;

    return (
        <div className="kanban-page h-100">
            <div className="kanban-board d-flex gap-3 p-3" style={{ overflowX: "auto", minHeight: "calc(100vh - 200px)" }}>
                {COLUMNS.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        tasks={tasksByColumn[column.id] || []}
                        onDrop={handleDrop}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onTimerToggle={handleTimerToggle}
                        runningTimers={runningTimers}
                        t={t}
                    />
                ))}
            </div>
            <style>{`
                .kanban-card.dragging { transform: rotate(3deg); box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
                .kanban-column.drag-over { border: 2px dashed #0d6efd; }
                .kanban-card { transition: transform 0.15s, box-shadow 0.15s; }
                .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
            `}</style>

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
