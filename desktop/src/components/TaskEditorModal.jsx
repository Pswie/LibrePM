import { useState, useEffect, useRef, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import PortalModal from "./PortalModal.jsx";
import { librepm } from "@api/librepm.js";
import { useTranslation } from 'react-i18next';
import { useWorkflow } from "../context/WorkflowContext.jsx";
import { useModal } from "../hooks/useModal.js";
import BacklinksPanel from "./BacklinksPanel.jsx";

/**
 * TaskEditorModal - Modale per creare/editare task
 *
 * Stile conformato a ProjectDetailModal (PortalModal + Bootstrap classes)
 */
export default function TaskEditorModal({
                                            show,
                                            onHide,
                                            task = null,
                                            projectId,
                                            onSave,
                                            onNavigateToNote, // Callback per navigare alla pagina note
                                            defaults = null   // { plannedStart, plannedFinish, deadline } for pre-filling new tasks
                                        }) {
    const { t } = useTranslation();
    const { statuses, priorities, getStatusByName, getPriorityByName } = useWorkflow();
    const modal = useModal();

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [markdownNotes, setMarkdownNotes] = useState("");
    const [statusId, setStatusId] = useState("");
    const [priorityId, setPriorityId] = useState("");
    const [deadline, setDeadline] = useState(null);
    const [owner, setOwner] = useState("");
    const [assignedToId, setAssignedToId] = useState("");
    const [tags, setTags] = useState([]);
    const [newTag, setNewTag] = useState("");
    
    // New fields for Gantt support
    const [taskType, setTaskType] = useState("TASK");
    const [plannedStart, setPlannedStart] = useState(null);
    const [plannedFinish, setPlannedFinish] = useState(null);
    const [estimatedEffort, setEstimatedEffort] = useState("");
    const [effortManual, setEffortManual] = useState(false); // true = user edited manually

    // Extended fields (PRD-01-FR-006)
    const [planningEnabled, setPlanningEnabled] = useState(false);
    const [financeEnabled, setFinanceEnabled] = useState(false);
    const [phaseId, setPhaseId] = useState("");
    const [deliverableId, setDeliverableId] = useState("");
    const [stakeholderId, setStakeholderId] = useState("");
    const [fundingContext, setFundingContext] = useState("");
    const [actualStart, setActualStart] = useState(null);
    const [actualEnd, setActualEnd] = useState(null);
    const [estimatedEffortHours, setEstimatedEffortHours] = useState("");
    const [actualEffortHours, setActualEffortHours] = useState("");

    // Checklist
    const [checklistItems, setChecklistItems] = useState([]);
    const [newChecklistItem, setNewChecklistItem] = useState("");

    // Team Members
    const [members, setMembers] = useState([]);

    // Assets state
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [existingAssets, setExistingAssets] = useState([]);

    // UI state
    const [showPreview, setShowPreview] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("details"); // 'details' | 'notes'

    // Notes (Chat) state
    const [taskNotes, setTaskNotes] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState("");
    const [loadingNotes, setLoadingNotes] = useState(false);
    const notesEndRef = useRef(null);
    const currentUserId = librepm.getCurrentUser();

    // History state (PRD-01-FR-008)
    const [statusHistory, setStatusHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Task Types
    const taskTypes = [
        "TASK", "MILESTONE", "MEETING", "CALL", "APPOINTMENT",
        "DEADLINE", "REMINDER", "TASK_BLOCK", "SUMMARY_TASK",
        "DELIVERABLE_TASK", "REVIEW_TASK", "FINANCE_TASK"
    ];

    const resetForm = useCallback(() => {
        setTitle("");
        setDescription("");
        setMarkdownNotes("");
        const defaultStatus = getStatusByName("TODO");
        setStatusId(defaultStatus?.id || (statuses[0]?.id ?? ""));
        const defaultPriority = getPriorityByName("MEDIUM");
        setPriorityId(defaultPriority?.id || (priorities[0]?.id ?? ""));
        setDeadline(null);
        setOwner("");
        setTags([]);
        
        // Reset Gantt fields
        setTaskType("TASK");
        setPlannedStart(null);
        setPlannedFinish(null);
        setEstimatedEffort("");
        setEffortManual(false);

        // Reset extended fields
        setPlanningEnabled(false);
        setFinanceEnabled(false);
        setPhaseId("");
        setDeliverableId("");
        setStakeholderId("");
        setFundingContext("");
        setActualStart(null);
        setActualEnd(null);
        setEstimatedEffortHours("");
        setActualEffortHours("");

        setChecklistItems([]);
        setUploadedFiles([]);
        setExistingAssets([]);
        setErrors({});
        setActiveTab("details");
        setTaskNotes([]);
        setNewNoteContent("");
    }, [statuses, priorities, getStatusByName, getPriorityByName]);

    const loadHistory = useCallback(async (taskId) => {
        if (!projectId) return;
        try {
            setLoadingHistory(true);
            const history = await librepm.tasksHistory(projectId, taskId);
            setStatusHistory(history || []);
        } catch (e) {
            console.error("Error loading history:", e);
        } finally {
            setLoadingHistory(false);
        }
    }, [projectId]);

    const loadTaskNotes = useCallback(async (taskId) => {
        try {
            setLoadingNotes(true);
            // Use new specific endpoint
            const notes = await librepm.notesListTask(taskId);
            setTaskNotes(notes);
        } catch (e) {
            console.error("Errore caricamento note:", e);
        } finally {
            setLoadingNotes(false);
        }
    }, []);
    
    // Load members when modal opens
    useEffect(() => {
        if (show && projectId) {
            const loadMembers = async () => {
                try {
                    const list = await librepm.projectMembersList(projectId);
                    setMembers(list || []);
                    
                    // If new task, default assignedTo to project owner
                    if (!task && list && list.length > 0) {
                        const projectOwner = list.find(m => m.role === 'OWNER');
                        if (projectOwner) {
                            setOwner(projectOwner.user.displayName || projectOwner.user.username);
                            setAssignedToId(projectOwner.user.id);
                        }
                    }
                } catch (e) {
                    console.error("Failed to load project members", e);
                }
            };
            loadMembers();
        }
    }, [show, projectId, task]);

    useEffect(() => {
        if (show && task) {
            setTitle(task.title || "");
            setDescription(task.description || "");
            setMarkdownNotes(task.markdownNotes || task.notes || "");
            setStatusId(task.statusId || (getStatusByName(task.statusName)?.id) || "");
            setPriorityId(task.priorityId || (getPriorityByName(task.priorityName)?.id) || "");
            setDeadline(task.deadline ? new Date(task.deadline) : null);
            setOwner(task.owner || "");
            setAssignedToId(task.assignedToId || "");
            setTags(task.tags || []);
            
            // Populate Gantt fields
            setTaskType(task.type || "TASK");
            setPlannedStart(task.plannedStart ? new Date(task.plannedStart) : null);
            setPlannedFinish(task.plannedFinish ? new Date(task.plannedFinish) : null);
            setEstimatedEffort(task.estimatedEffort || "");
            setEffortManual(!!task.estimatedEffort); // respect existing effort

            // Extended fields
            setPlanningEnabled(task.planningEnabled || false);
            setFinanceEnabled(task.financeEnabled || false);
            setPhaseId(task.phaseId || "");
            setDeliverableId(task.deliverableId || "");
            setStakeholderId(task.stakeholderId || "");
            setFundingContext(task.fundingContext || "");
            setActualStart(task.actualStart ? new Date(task.actualStart) : null);
            setActualEnd(task.actualEnd ? new Date(task.actualEnd) : null);
            setEstimatedEffortHours(task.estimatedEffortHours || "");
            setActualEffortHours(task.actualEffortHours || "");

            setChecklistItems(task.checklistItems || []);
            setExistingAssets(task.assets || []);

            // Load notes if tab is active or just pre-load
            loadTaskNotes(task.id);
        } else if (show) {
            resetForm();
            // Apply defaults for new task (e.g. dates from calendar click)
            if (defaults) {
                if (defaults.plannedStart) setPlannedStart(defaults.plannedStart);
                if (defaults.plannedFinish) setPlannedFinish(defaults.plannedFinish);
                if (defaults.deadline) setDeadline(defaults.deadline);
                // Auto-calc effort from default dates
                if (defaults.plannedStart && defaults.plannedFinish) {
                    const mins = calcEffortFromDates(defaults.plannedStart, defaults.plannedFinish);
                    if (mins) setEstimatedEffort(String(mins));
                }
            }
        }
    }, [show, task, loadTaskNotes, resetForm, getStatusByName, getPriorityByName, defaults]);

    useEffect(() => {
        if (activeTab === "notes" && notesEndRef.current) {
            notesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
        if (activeTab === "history" && task?.id) {
            loadHistory(task.id);
        }
    }, [taskNotes, activeTab, task?.id, loadHistory]);

    const handleSendNote = async (e) => {
        e.preventDefault();
        if (!newNoteContent.trim() || !task) return;

        try {
            const noteData = {
                title: t("Task Note"), // Titolo opzionale o fisso
                content: newNoteContent
            };
            // Use new specific endpoint
            await librepm.notesCreateTask(task.id, noteData);
            setNewNoteContent("");
            loadTaskNotes(task.id); // Refresh notes
        } catch (e) {
            toast.error(t("Error sending note"));
        }
    };

    const handleDeleteNote = async (noteId) => {
        const confirmed = await modal.confirm({
            title: t("Delete this note?"),
            message: t("Are you sure you want to delete this note? This action is irreversible.")
        });
        if (!confirmed) return;
        try {
            await librepm.notesDelete(noteId);
            setTaskNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (e) {
            toast.error(t("Error deleting note"));
        }
    };

    const handleEditNote = (note) => {
        if (onNavigateToNote) {
            onNavigateToNote(note);
            onHide(); // Close the modal
        }
    };

    // Auto-calculate effort from planned dates (business days × 480 min = 8h/day)
    const calcEffortFromDates = useCallback((start, finish) => {
        if (!start || !finish || finish <= start) return null;
        const msPerDay = 86400000;
        let days = 0;
        const cur = new Date(start);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(finish);
        end.setHours(0, 0, 0, 0);
        while (cur < end) {
            const dow = cur.getDay();
            if (dow !== 0 && dow !== 6) days++; // skip weekends
            cur.setDate(cur.getDate() + 1);
        }
        return Math.max(1, days) * 480; // min 1 day = 480 min
    }, []);

    // Auto-behavior handlers
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setTaskType(newType);
        
        if (newType === "MILESTONE") {
            if (plannedStart) {
                setPlannedFinish(plannedStart);
            }
            setEstimatedEffort("");
        }
    };

    const handlePlannedStartChange = (date) => {
        setPlannedStart(date);

        if (date) {
            let newFinish = plannedFinish;
            if (taskType === "MILESTONE") {
                newFinish = date;
                setPlannedFinish(date);
            } else if (!plannedFinish) {
                const nextDay = new Date(date);
                nextDay.setDate(nextDay.getDate() + 1);
                newFinish = nextDay;
                setPlannedFinish(nextDay);
            } else if (plannedFinish < date) {
                const nextDay = new Date(date);
                nextDay.setDate(nextDay.getDate() + 1);
                newFinish = nextDay;
                setPlannedFinish(nextDay);
            }
            // Auto-calc effort if not manually set
            if (!effortManual && taskType !== "MILESTONE" && newFinish) {
                const mins = calcEffortFromDates(date, newFinish);
                if (mins) setEstimatedEffort(String(mins));
            }
        }
    };

    const handlePlannedFinishChange = (date) => {
        setPlannedFinish(date);
        if (!effortManual && taskType !== "MILESTONE" && plannedStart && date) {
            const mins = calcEffortFromDates(plannedStart, date);
            if (mins) setEstimatedEffort(String(mins));
        }
    };

    const handleEffortManualChange = (e) => {
        setEffortManual(true);
        setEstimatedEffort(e.target.value);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
            toast.success(`${acceptedFiles.length} ${t("files uploaded")}`);
        },
        multiple: true,
        maxSize: 10485760, // 10MB
    });

    const addTag = () => {
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setNewTag("");
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    // Checklist functions
    const addChecklistItem = () => {
        if (!newChecklistItem.trim()) return;
        const newItem = {
            id: `temp-${Date.now()}`, // Temporary ID for new items
            content: newChecklistItem.trim(),
            done: false
        };
        setChecklistItems([...checklistItems, newItem]);
        setNewChecklistItem("");
    };

    const toggleChecklistItem = (index) => {
        const newItems = [...checklistItems];
        newItems[index].done = !newItems[index].done;
        setChecklistItems(newItems);
    };

    const removeChecklistItem = (index) => {
        const newItems = [...checklistItems];
        newItems.splice(index, 1);
        setChecklistItems(newItems);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!title.trim()) newErrors.title = t("Title is required");
        if (title.length > 500) newErrors.title = t("Title cannot exceed 500 characters");
        
        if (plannedStart && plannedFinish && plannedFinish < plannedStart) {
            newErrors.dates = t("End date cannot be before start date");
            toast.error(t("End date cannot be before start date"));
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleClose = useCallback(() => {
        resetForm();
        onHide();
    }, [resetForm, onHide]);

    const handleSave = async () => {
        if (!validateForm()) {
            toast.error(t("Please fix form errors"));
            return;
        }

        setIsSubmitting(true);

        try {
            const taskData = {
                title: title.trim(),
                description: description.trim(),
                markdownNotes: markdownNotes,
                statusId,
                priorityId,
                deadline: deadline ? deadline.toISOString().split('T')[0] : null,
                owner: owner.trim(),
                assignedToId: assignedToId || null,

                // Gantt fields
                type: taskType,
                plannedStart: plannedStart ? plannedStart.toISOString().replace('Z', '') : null,
                plannedFinish: plannedFinish ? plannedFinish.toISOString().replace('Z', '') : null,
                estimatedEffort: estimatedEffort ? parseInt(estimatedEffort) : null,

                // Extended fields (PRD-01-FR-006)
                planningEnabled,
                financeEnabled,
                phaseId: phaseId || null,
                deliverableId: deliverableId || null,
                stakeholderId: stakeholderId || null,
                fundingContext: fundingContext || null,
                actualStart: actualStart ? actualStart.toISOString().split('T')[0] : null,
                actualEnd: actualEnd ? actualEnd.toISOString().split('T')[0] : null,
                estimatedEffortHours: estimatedEffortHours ? parseFloat(estimatedEffortHours) : null,
                actualEffortHours: actualEffortHours ? parseFloat(actualEffortHours) : null,

                tags,
                checklistItems: checklistItems.map(item => ({
                    content: item.content,
                    done: item.done
                })),
                projectId,
            };

            if (task) {
                taskData.id = task.id;
            }

            await onSave(taskData, uploadedFiles);
            toast.success(task ? t("Task updated!") : t("Task created!"));
            handleClose();
        } catch (error) {
            console.error("Errore salvataggio task:", error);
            toast.error(t("Error saving task"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const removeFile = (index) => {
        setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
    };

    const removeExistingAsset = (assetId) => {
        setExistingAssets(existingAssets.filter((a) => a.id !== assetId));
    };

    const handleDownloadAsset = async (asset) => {
        try {
            await librepm.assetsDownload(asset.id, asset.fileName);
        } catch (error) {
            toast.error(`${t('Error')}: ${error.message}`);
        }
    };

    if (!show) return null;

    return (
        <PortalModal
            className="modal-xl modal-dialog-scrollable"
            onClick={handleClose}
            style={{ maxWidth: "1140px" }}
        >
            <div style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                <div className="modal-header">
                    <h5 className="modal-title">
                        {task ? t("Edit Task") : t("New Task")}
                    </h5>
                    <button type="button" className="btn-close" onClick={handleClose}></button>
                </div>

                {/* Tabs Navigation */}
                {task && (
                    <div className="modal-header border-bottom-0 pb-0 pt-0">
                        <ul className="nav nav-tabs w-100 border-bottom-0">
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${activeTab === 'details' ? 'active fw-bold' : ''}`}
                                    onClick={() => setActiveTab('details')}
                                >
                                    <i className="bi bi-pencil me-2"></i>
                                    {t("Details")}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${activeTab === 'notes' ? 'active fw-bold' : ''}`}
                                    onClick={() => setActiveTab('notes')}
                                >
                                    <i className="bi bi-chat-square-text me-2"></i>
                                    {t("Notes & Discussion")}
                                    {taskNotes.length > 0 && <span className="badge bg-secondary ms-2 rounded-pill">{taskNotes.length}</span>}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    className={`nav-link ${activeTab === 'history' ? 'active fw-bold' : ''}`}
                                    onClick={() => setActiveTab('history')}
                                >
                                    <i className="bi bi-clock-history me-2"></i>
                                    {t("History")}
                                </button>
                            </li>
                        </ul>
                    </div>
                )}

                <div className="modal-body bg-light" style={{ overflowY: "auto", flexGrow: 1, padding: "1.5rem" }}>
                    
                    {/* TAB DETTAGLI */}
                    {activeTab === 'details' && (
                        <form className="bg-white p-4 rounded shadow-sm">
                            {/* Titolo Task */}
                            <div className="mb-3">
                                <label className="form-label fw-bold">
                                    {t("Title")} <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-control ${errors.title ? "is-invalid" : ""}`}
                                    placeholder={t("Ex: Complete project presentation...")}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    autoFocus
                                />
                                {errors.title && <div className="invalid-feedback">{errors.title}</div>}
                            </div>

                            {/* Descrizione breve */}
                            <div className="mb-3">
                                <label className="form-label fw-bold">{t("Short Description")}</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    placeholder={t("Brief task description...")}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                ></textarea>
                            </div>

                            {/* Row: Status, Priority, Deadline, Owner */}
                            <div className="row mb-3">
                                <div className="col-md-3">
                                    <label className="form-label fw-bold">{t("Status")}</label>
                                    <select
                                        className="form-select"
                                        value={statusId}
                                        onChange={(e) => setStatusId(e.target.value)}
                                    >
                                        {statuses.map(s => (
                                            <option key={s.id} value={s.id} style={{ color: s.color }}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label fw-bold">{t("Priority")}</label>
                                    <select
                                        className="form-select"
                                        value={priorityId}
                                        onChange={(e) => setPriorityId(e.target.value)}
                                    >
                                        {priorities.map(p => (
                                            <option key={p.id} value={p.id} style={{ color: p.color }}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label fw-bold">{t("Deadline")}</label>
                                    <div className="d-block">
                                        <DatePicker
                                            selected={deadline}
                                            onChange={(date) => setDeadline(date)}
                                            dateFormat="dd/MM/yyyy"
                                            placeholderText={t("Select date")}
                                            className="form-control w-100"
                                            isClearable
                                        />
                                    </div>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label fw-bold">{t("Owner")}</label>
                                    <select
                                        className="form-select"
                                        value={assignedToId}
                                        onChange={(e) => {
                                            const userId = e.target.value;
                                            setAssignedToId(userId);
                                            const member = members.find(m => m.user.id === userId);
                                            setOwner(member ? (member.user.displayName || member.user.username) : "");
                                        }}
                                    >
                                        <option value="">{t("Select owner...")}</option>
                                        {members.map(m => (
                                            <option key={m.user.id} value={m.user.id}>
                                                {m.user.displayName || m.user.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {/* Row: Type, Planned Start, Planned Finish, Estimated Effort */}
                            <div className="row mb-3 bg-light p-2 rounded border">
                                <div className="col-12 mb-2">
                                    <small className="text-muted text-uppercase fw-bold" style={{fontSize: '0.7rem'}}>
                                        {t("Planning & Gantt")}
                                    </small>
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label fw-bold small">{t("Type")}</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={taskType}
                                        onChange={handleTypeChange}
                                    >
                                        {taskTypes.map(type => (
                                            <option key={type} value={type}>
                                                {t(type)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="col-md-3">
                                    <label className="form-label fw-bold small">{t("Planned Start")}</label>
                                    <div className="d-block">
                                        <DatePicker
                                            selected={plannedStart}
                                            onChange={handlePlannedStartChange}
                                            dateFormat="dd/MM/yyyy HH:mm"
                                            timeFormat="HH:mm"
                                            showTimeSelect
                                            placeholderText={t("Start Date")}
                                            className="form-control form-control-sm w-100"
                                            isClearable
                                        />
                                    </div>
                                </div>
                                
                                <div className="col-md-3">
                                    <label className="form-label fw-bold small">{t("Planned Finish")}</label>
                                    <div className="d-block">
                                        {taskType !== "MILESTONE" ? (
                                            <DatePicker
                                                selected={plannedFinish}
                                                onChange={handlePlannedFinishChange}
                                                dateFormat="dd/MM/yyyy HH:mm"
                                                timeFormat="HH:mm"
                                                showTimeSelect
                                                placeholderText={t("End Date")}
                                                className={`form-control form-control-sm w-100 ${errors.dates ? "is-invalid" : ""}`}
                                                minDate={plannedStart}
                                                isClearable
                                            />
                                        ) : (
                                            <input 
                                                type="text" 
                                                className="form-control form-control-sm" 
                                                value={plannedStart ? plannedStart.toLocaleString() : "-"} 
                                                disabled 
                                            />
                                        )}
                                        {errors.dates && <div className="invalid-feedback">{errors.dates}</div>}
                                    </div>
                                </div>
                                
                                <div className="col-md-3">
                                    <label className="form-label fw-bold small">
                                        {t("Estimated Effort")}
                                        {!effortManual && estimatedEffort && taskType !== "MILESTONE" && (
                                            <i className="bi bi-calculator ms-1 text-info" title={t("Auto-calculated from dates")} style={{fontSize: '0.75rem'}}></i>
                                        )}
                                    </label>
                                    {taskType !== "MILESTONE" ? (
                                        <>
                                            <div className="input-group input-group-sm">
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    placeholder="0"
                                                    value={estimatedEffort}
                                                    onChange={handleEffortManualChange}
                                                    min="0"
                                                />
                                                <span className="input-group-text">{t("min")}</span>
                                            </div>
                                            {estimatedEffort && Number(estimatedEffort) >= 480 && (
                                                <small className="text-muted" style={{fontSize: '0.7rem'}}>
                                                    ≈ {(Number(estimatedEffort) / 480).toFixed(1)} {t("days")} (8h/{t("day")})
                                                </small>
                                            )}
                                        </>
                                    ) : (
                                        <input type="text" className="form-control form-control-sm" value="0 min" disabled />
                                    )}
                                </div>
                            </div>

                            {/* Extended Planning Section (PRD-01-FR-006) — Progressive Disclosure */}
                            <div className="mb-3">
                                <div
                                    className="d-flex align-items-center gap-2 cursor-pointer user-select-none"
                                    onClick={() => setPlanningEnabled(!planningEnabled)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <i className={`bi ${planningEnabled ? "bi-chevron-down" : "bi-chevron-right"} text-muted`}></i>
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.7rem" }}>
                                        {t("Advanced Planning")}
                                    </small>
                                </div>
                                {planningEnabled && (
                                    <div className="row mt-2 bg-light p-2 rounded border">
                                        <div className="col-md-3 mb-2">
                                            <label className="form-label fw-bold small">{t("Actual Start")}</label>
                                            <DatePicker
                                                selected={actualStart}
                                                onChange={(d) => setActualStart(d)}
                                                dateFormat="dd/MM/yyyy"
                                                placeholderText={t("Actual Start")}
                                                className="form-control form-control-sm w-100"
                                                isClearable
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <label className="form-label fw-bold small">{t("Actual End")}</label>
                                            <DatePicker
                                                selected={actualEnd}
                                                onChange={(d) => setActualEnd(d)}
                                                dateFormat="dd/MM/yyyy"
                                                placeholderText={t("Actual End")}
                                                className="form-control form-control-sm w-100"
                                                isClearable
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <label className="form-label fw-bold small">{t("Est. Hours")}</label>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                placeholder="0"
                                                value={estimatedEffortHours}
                                                onChange={(e) => setEstimatedEffortHours(e.target.value)}
                                                min="0"
                                                step="0.5"
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <label className="form-label fw-bold small">{t("Actual Hours")}</label>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                placeholder="0"
                                                value={actualEffortHours}
                                                onChange={(e) => setActualEffortHours(e.target.value)}
                                                min="0"
                                                step="0.5"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-2">
                                            <label className="form-label fw-bold small">{t("Deliverable")}</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder={t("Linked deliverable ID")}
                                                value={deliverableId}
                                                onChange={(e) => setDeliverableId(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-2">
                                            <label className="form-label fw-bold small">{t("Stakeholder")}</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder={t("Linked stakeholder ID")}
                                                value={stakeholderId}
                                                onChange={(e) => setStakeholderId(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Finance Section (PRD-01-FR-006) — Progressive Disclosure */}
                            <div className="mb-3">
                                <div
                                    className="d-flex align-items-center gap-2"
                                    onClick={() => setFinanceEnabled(!financeEnabled)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <i className={`bi ${financeEnabled ? "bi-chevron-down" : "bi-chevron-right"} text-muted`}></i>
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.7rem" }}>
                                        {t("Finance Context")}
                                    </small>
                                </div>
                                {financeEnabled && (
                                    <div className="row mt-2 bg-light p-2 rounded border">
                                        <div className="col-12">
                                            <label className="form-label fw-bold small">{t("Funding Context")}</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder={t("e.g. Grant XYZ, Budget line 42")}
                                                value={fundingContext}
                                                onChange={(e) => setFundingContext(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Checklist */}
                            <div className="mb-3">
                                <label className="form-label fw-bold">{t("Checklist")}</label>
                                <div className="input-group mb-2">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={t("Add checklist item...")}
                                        value={newChecklistItem}
                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addChecklistItem();
                                            }
                                        }}
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={addChecklistItem}
                                        disabled={!newChecklistItem.trim()}
                                    >
                                        <i className="bi bi-plus-lg"></i>
                                    </button>
                                </div>
                                <div className="list-group">
                                    {checklistItems.map((item, index) => (
                                        <div key={index} className="list-group-item d-flex align-items-center justify-content-between p-2">
                                            <div className="form-check d-flex align-items-center flex-grow-1">
                                                <input
                                                    className="form-check-input me-2"
                                                    type="checkbox"
                                                    checked={item.done}
                                                    onChange={() => toggleChecklistItem(index)}
                                                    id={`checklist-item-${index}`}
                                                />
                                                <label 
                                                    className={`form-check-label ${item.done ? 'text-decoration-line-through text-muted' : ''}`}
                                                    htmlFor={`checklist-item-${index}`}
                                                    style={{ cursor: "pointer", width: "100%" }}
                                                >
                                                    {item.content}
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-link text-danger p-0 ms-2"
                                                onClick={() => removeChecklistItem(index)}
                                            >
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                    ))}
                                    {checklistItems.length > 0 && (
                                        <div className="mt-2 small text-muted">
                                            {Math.round((checklistItems.filter(i => i.done).length / checklistItems.length) * 100)}% {t("completed")}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="mb-3">
                                <label className="form-label fw-bold">{t("Tags")}</label>
                                <div className="d-flex gap-2 mb-2 flex-wrap">
                                    {tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="badge bg-info text-dark d-flex align-items-center gap-1"
                                            style={{ fontSize: "0.9rem" }}
                                        >
                                            {tag}
                                            <i 
                                                className="bi bi-x-lg ms-1"
                                                style={{ cursor: "pointer" }}
                                                onClick={() => removeTag(tag)}
                                            ></i>
                                        </span>
                                    ))}
                                </div>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={t("Add tag...")}
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addTag();
                                            }
                                        }}
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={addTag}
                                        disabled={!newTag.trim()}
                                    >
                                        <i className="bi bi-plus-lg"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Editor Markdown per Note */}
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="form-label fw-bold mb-0">
                                        {t("Markdown Notes (Personal)")}
                                    </label>
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="previewSwitch"
                                            checked={showPreview}
                                            onChange={(e) => setShowPreview(e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor="previewSwitch">{t("Preview")}</label>
                                    </div>
                                </div>
                                <div data-color-mode="light">
                                    <MDEditor
                                        value={markdownNotes}
                                        onChange={setMarkdownNotes}
                                        preview={showPreview ? "preview" : "edit"}
                                        height={300}
                                        visibleDragbar={false}
                                        textareaProps={{
                                            placeholder: t("Write your notes in Markdown...")
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Upload Assets */}
                            <div className="mb-3">
                                <label className="form-label fw-bold">{t("Attachments")}</label>

                                {/* Dropzone */}
                                <div
                                    {...getRootProps()}
                                    className={`border rounded p-4 text-center ${
                                        isDragActive ? "bg-light border-primary" : "bg-white border-secondary"
                                    }`}
                                    style={{ cursor: "pointer", borderStyle: "dashed" }}
                                >
                                    <input {...getInputProps()} />
                                    <i className="bi bi-cloud-upload fs-2 mb-2 text-muted d-block"></i>
                                    <p className="mb-0 text-muted">
                                        {isDragActive
                                            ? t("Drop files here...")
                                            : t("Drag files here or click to select")}
                                    </p>
                                    <small className="text-muted">{t("Max 10MB per file")}</small>
                                </div>

                                {/* Lista file caricati */}
                                {uploadedFiles.length > 0 && (
                                    <div className="mt-3">
                                        <h6>{t("Files to upload:")}</h6>
                                        {uploadedFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="d-flex align-items-center justify-content-between p-2 bg-light border rounded mb-2"
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-file-earmark"></i>
                                                    <span>{file.name}</span>
                                                    <small className="text-muted">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </small>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm"
                                                    onClick={() => removeFile(idx)}
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Asset esistenti (in edit mode) */}
                                {existingAssets.length > 0 && (
                                    <div className="mt-3">
                                        <h6>{t("Existing assets:")}</h6>
                                        {existingAssets.map((asset) => (
                                            <div
                                                key={asset.id}
                                                className="d-flex align-items-center justify-content-between p-2 bg-light border border-success rounded mb-2"
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-file-earmark text-success"></i>
                                                    <span>{asset.fileName}</span>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-primary btn-sm"
                                                        onClick={() => handleDownloadAsset(asset)}
                                                        title={t("Download")}
                                                    >
                                                        <i className="bi bi-download"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm"
                                                        onClick={() => removeExistingAsset(asset.id)}
                                                        title={t("Delete")}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>
                    )}

                    {/* TAB NOTE (CHAT) */}
                    {activeTab === 'notes' && (
                        <div className="d-flex flex-column h-100 bg-white rounded shadow-sm overflow-hidden">
                            <div className="flex-grow-1 p-3 overflow-auto" style={{ minHeight: '300px' }}>
                                {/* Backlinks (PRD-02-FR-005) */}
                                {task?.id && (
                                    <div className="mb-3 pb-2 border-bottom">
                                        <BacklinksPanel
                                            entityType="TASK"
                                            entityId={task.id}
                                            onNavigate={(noteId) => handleEditNote({ id: noteId })}
                                        />
                                    </div>
                                )}
                                {loadingNotes && <div className="text-center text-muted">{t("Loading notes...")}</div>}
                                {!loadingNotes && taskNotes.length === 0 && (
                                    <div className="text-center text-muted mt-5">
                                        <i className="bi bi-chat-square-text fs-1 mb-3 opacity-25 d-block"></i>
                                        <p>{t("No notes yet. Start the discussion!")}</p>
                                    </div>
                                )}
                                {taskNotes.map(note => {
                                    const isMe = note.owner.id === currentUserId;
                                    return (
                                        <div key={note.id} className={`d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                                            {!isMe && (
                                                <div className="me-2">
                                                    <div className="avatar-circle bg-secondary text-white d-flex align-items-center justify-content-center" style={{width: 32, height: 32, borderRadius: '50%', fontSize: '0.8rem'}}>
                                                        {(note.owner.displayName || note.owner.username).substring(0, 2).toUpperCase()}
                                                    </div>
                                                </div>
                                            )}
                                            <div className={`card border-0 shadow-sm ${isMe ? 'bg-primary text-white' : 'bg-light'}`} style={{ maxWidth: '75%' }}>
                                                <div className="card-body p-2 px-3">
                                                    {!isMe && <div className="fw-bold small mb-1 text-primary">{note.owner.displayName || note.owner.username}</div>}
                                                    <div style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
                                                    <div className={`d-flex justify-content-between align-items-center mt-1 ${isMe ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>
                                                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                                                        <div className="d-flex gap-2 ms-2">
                                                            {isMe && (
                                                                <>
                                                                    <button className="btn btn-link p-0 text-white-50" onClick={() => handleEditNote(note)} title={t("Edit")}>
                                                                        <i className="bi bi-pencil"></i>
                                                                    </button>
                                                                    <button className="btn btn-link p-0 text-white-50" onClick={() => handleDeleteNote(note.id)} title={t("Delete")}>
                                                                        <i className="bi bi-trash"></i>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={notesEndRef} />
                            </div>
                            <div className="p-3 border-top bg-light">
                                <form onSubmit={handleSendNote} className="d-flex gap-2">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={t("Write a note...")}
                                        value={newNoteContent}
                                        onChange={(e) => setNewNoteContent(e.target.value)}
                                    />
                                    <button type="submit" className="btn btn-primary" disabled={!newNoteContent.trim()}>
                                        <i className="bi bi-send"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* TAB HISTORY (PRD-01-FR-008) */}
                    {activeTab === 'history' && (
                        <div className="bg-white rounded shadow-sm p-3" style={{ minHeight: '300px' }}>
                            {loadingHistory && <div className="text-center text-muted">{t("Loading...")}</div>}
                            {!loadingHistory && statusHistory.length === 0 && (
                                <div className="text-center text-muted mt-5">
                                    <i className="bi bi-clock-history fs-1 mb-3 opacity-25 d-block"></i>
                                    <p>{t("No history yet")}</p>
                                </div>
                            )}
                            {!loadingHistory && statusHistory.length > 0 && (
                                <div className="list-group list-group-flush">
                                    {statusHistory.map((entry) => (
                                        <div key={entry.id} className="list-group-item px-0 border-start-0 border-end-0">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <span className="badge bg-secondary me-1">{entry.oldStatus || "—"}</span>
                                                    <i className="bi bi-arrow-right mx-1 text-muted"></i>
                                                    <span className="badge bg-primary">{entry.newStatus}</span>
                                                </div>
                                                <small className="text-muted">
                                                    {new Date(entry.changedAt).toLocaleString()}
                                                </small>
                                            </div>
                                            {entry.comment && (
                                                <small className="text-muted d-block mt-1">{entry.comment}</small>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer bg-light">
                    <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
                        {t("Close")}
                    </button>
                    {task && activeTab === 'details' && (
                        <div className="dropdown me-auto">
                            <button className="btn btn-outline-info dropdown-toggle btn-sm" type="button" data-bs-toggle="dropdown">
                                <i className="bi bi-eye me-1"></i>{t("Request Review")}
                            </button>
                            <ul className="dropdown-menu">
                                {members.filter(m => m.user.id !== librepm.getCurrentUser()).map(m => (
                                    <li key={m.user.id}>
                                        <button
                                            className="dropdown-item"
                                            onClick={async () => {
                                                try {
                                                    await librepm.tasksRequestReview(projectId, task.id, m.user.id);
                                                    toast.success(t("Review requested"));
                                                } catch (e) {
                                                    toast.error(t("Error") + ": " + e.message);
                                                }
                                            }}
                                        >
                                            {m.user.displayName || m.user.username}
                                        </button>
                                    </li>
                                ))}
                                {members.filter(m => m.user.id !== librepm.getCurrentUser()).length === 0 && (
                                    <li><span className="dropdown-item text-muted">{t("No members available")}</span></li>
                                )}
                            </ul>
                        </div>
                    )}
                    {activeTab === 'details' && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t("Saving...") : (task ? t("Update") : t("Create Task"))}
                        </button>
                    )}
                </div>
            </div>
        </PortalModal>
    );
}
