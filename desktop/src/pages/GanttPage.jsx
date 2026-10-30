import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { librepm } from '@api/librepm.js';
import GanttChart from '../components/gantt/GanttChart.jsx';
import TaskEditorModal from '../components/TaskEditorModal.jsx';
import ProjectRequired from '../components/ProjectRequired.jsx';

/**
 * GanttPage - Advanced planning view using a Gantt chart (PRD-10).
 *
 * Layout strategy: the page renders as a normal block flow inside .jl-page
 * (which provides vertical scroll). The GanttChart handles only horizontal
 * scroll for the timeline. No nested scroll containers.
 */
export default function GanttPage({ shell }) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [viewMode, setViewMode] = useState('Week');

    // Force re-render when switching projects
    useEffect(() => {
        setTasks([]);
        setLoading(true);
        if (shell?.currentProject) {
            loadGanttData();
        } else {
            setLoading(false);
        }
    }, [shell?.currentProject]);

    useEffect(() => {
        shell?.setTitle?.(t("Gantt Chart"));
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
                    onClick={loadGanttData}
                    title={t("Refresh")}
                >
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        );

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, t]);

    const loadGanttData = useCallback(async () => {
        if (!shell?.currentProject) return;
        setLoading(true);
        try {
            let ganttData = [];
            try {
                ganttData = await librepm.tasksGantt(shell.currentProject.id);
            } catch (e) {
                console.warn("Gantt endpoint failed, trying fallback list", e);
            }

            if (!ganttData || ganttData.length === 0) {
                const tasksList = await librepm.tasksList(shell.currentProject.id);
                ganttData = tasksList;
            }

            const processedData = ganttData.map(task => {
                let start = task.plannedStart ? new Date(task.plannedStart) : null;
                let end = task.plannedFinish ? new Date(task.plannedFinish) : null;

                const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
                const deadline = task.deadline ? new Date(task.deadline) : null;
                const effortMinutes = task.estimatedEffort ? parseInt(task.estimatedEffort) : 0;

                // --- START DATE INFERENCE ---
                if (!start) {
                    if (deadline && effortMinutes > 0) {
                        start = new Date(deadline);
                        const days = Math.ceil(effortMinutes / 480);
                        start.setDate(start.getDate() - days);
                    } else if (deadline) {
                        start = new Date(deadline);
                        start.setDate(start.getDate() - 1);
                    } else {
                        start = createdAt;
                    }
                }

                // --- END DATE INFERENCE ---
                if (!end) {
                    if (task.type === 'MILESTONE') {
                        end = new Date(start);
                    } else if (deadline) {
                        end = deadline;
                    } else if (effortMinutes > 0) {
                        end = new Date(start);
                        const days = Math.ceil(effortMinutes / 480);
                        end.setDate(end.getDate() + Math.max(1, days));
                    } else {
                        end = new Date(start);
                        end.setDate(end.getDate() + 1);
                    }
                }

                // Validation: End cannot be before Start
                if (end < start) {
                    end = new Date(start);
                    if (task.type !== 'MILESTONE') {
                        end.setHours(end.getHours() + 1);
                    }
                }

                if (isNaN(start.getTime())) start = new Date();
                if (isNaN(end.getTime())) {
                    end = new Date(start);
                    end.setDate(end.getDate() + 1);
                }

                return {
                    ...task,
                    // Pass Date objects — GanttChart's formatDateStr will preserve time info
                    start: start,
                    end: end,
                    plannedStart: start,
                    plannedFinish: end,
                    type: task.type || 'TASK',
                    progress: task.progress || 0,
                    name: task.title
                };
            });

            setTasks(processedData);
        } catch (e) {
            console.error("Error loading Gantt data:", e);
            toast.error(t("Error loading Gantt data"));
        } finally {
            setLoading(false);
        }
    }, [shell?.currentProject, t]);

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskModal(true);
    };

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
                await librepm.assetsUploadMultiple(uploadedFiles, `Asset for Task: ${taskData.title}`, taskId);
            }
            setShowTaskModal(false);
            loadGanttData();
        } catch (e) {
            toast.error(t("Error") + ": " + e.message);
        }
    };

    if (loading) {
        return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;
    }

    if (!shell?.currentProject) {
        return <ProjectRequired shell={shell} />;
    }

    return (
        <div className="gantt-page p-3">
            {/* Toolbar row */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-3">
                    <h5 className="mb-0 text-dark fw-bold">
                        {shell.currentProject.name}{' '}
                        <span className="text-muted fw-light">| {t("Timeline")}</span>
                    </h5>

                    {/* Legend */}
                    {tasks.length > 0 && (
                        <div className="d-none d-lg-flex gap-3 small text-muted border-start ps-3">
                            <div className="d-flex align-items-center gap-1" title={t("Critical Path")}>
                                <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: '#e74c3c' }}></div>
                                <span>{t("Critical")}</span>
                            </div>
                            <div className="d-flex align-items-center gap-1" title={t("Milestone")}>
                                <div style={{ width: 10, height: 10, backgroundColor: '#f39c12', transform: 'rotate(45deg)' }}></div>
                                <span>{t("Milestone")}</span>
                            </div>
                            <div className="d-flex align-items-center gap-1" title={t("Standard Task")}>
                                <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: '#3498db' }}></div>
                                <span>{t("Task")}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="d-flex gap-2 align-items-center">
                    {/* View mode selector */}
                    <div className="btn-group btn-group-sm shadow-sm">
                        {['Day', 'Week', 'Month'].map(mode => (
                            <button
                                key={mode}
                                className={`btn ${viewMode === mode ? 'btn-white text-dark fw-bold' : 'btn-light text-muted'}`}
                                onClick={() => setViewMode(mode)}
                                style={{ minWidth: '80px' }}
                            >
                                {t(mode)}
                            </button>
                        ))}
                    </div>

                    <button
                        className="btn btn-white btn-sm shadow-sm text-muted"
                        onClick={loadGanttData}
                        title={t("Refresh")}
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>

                    <button
                        className="btn btn-primary btn-sm shadow-sm d-flex align-items-center gap-2 px-3"
                        onClick={() => { setSelectedTask(null); setShowTaskModal(true); }}
                    >
                        <i className="bi bi-plus-lg"></i> {t("Add Task")}
                    </button>
                </div>
            </div>

            {/* Gantt chart — renders at natural SVG height, no wrapper constraints */}
            {tasks.length > 0 ? (
                <GanttChart
                    tasks={tasks}
                    viewMode={viewMode}
                    onTaskClick={handleTaskClick}
                />
            ) : (
                <div className="text-center py-5 text-muted">
                    <i className="bi bi-calendar-range fs-1 d-block mb-3 opacity-50"></i>
                    <p className="mb-0">{t("No tasks available for Gantt chart.")}</p>
                    <small>{t("Add tasks with start and end dates.")}</small>
                </div>
            )}

            {shell?.currentProject && (
                <TaskEditorModal
                    show={showTaskModal}
                    onHide={() => setShowTaskModal(false)}
                    task={selectedTask}
                    projectId={shell.currentProject.id}
                    onSave={handleSaveTask}
                />
            )}
        </div>
    );
}
