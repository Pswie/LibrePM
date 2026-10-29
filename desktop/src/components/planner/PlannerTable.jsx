import { useEffect, useMemo, useRef, useState } from "react";
import StatusPill from "./StatusPill.jsx";
import PriorityPill from "./PriorityPill.jsx";
import { useTranslation } from 'react-i18next';

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export default function PlannerTable({
                                         rows,
                                         onChangeRow,
                                         activeCell,
                                         onActiveCellChange,
                                         readOnlyEmpty = false,
                                     }) {
    const { t } = useTranslation();
    const [localActive, setLocalActive] = useState({ rowIndex: 0, colKey: "title" });

    const effActive = activeCell ?? localActive;
    const setActive = onActiveCellChange ?? setLocalActive;

    const refs = useRef({}); // key = `${rowId}:${colKey}` -> element

    const COLS = useMemo(() => [
        { key: "title", label: t("Task") },
        { key: "asset", label: t("Asset") },
        { key: "status", label: t("Status") },
        { key: "priority", label: t("Priority") },
        { key: "deadline", label: t("Deadline") },
        { key: "owner", label: t("Owner") },
        { key: "notes", label: t("Notes") },
    ], [t]);

    const colIndexByKey = useMemo(() => {
        const m = {};
        COLS.forEach((c, i) => (m[c.key] = i));
        return m;
    }, [COLS]);

    function setRef(rowId, colKey, el) {
        if (!rowId || !colKey) return;
        const k = `${rowId}:${colKey}`;
        if (el) refs.current[k] = el;
        else delete refs.current[k];
    }

    function focusCell(nextRowIndex, nextColKey) {
        const ri = clamp(nextRowIndex, 0, Math.max(0, rows.length - 1));
        const ck = nextColKey ?? "title";
        const row = rows[ri];
        if (!row) return;

        setActive({ rowIndex: ri, colKey: ck });

        requestAnimationFrame(() => {
            const el = refs.current[`${row.id}:${ck}`];
            if (el && typeof el.focus === "function") {
                el.focus();
                // seleziona testo sugli input
                if (el.tagName === "INPUT" && typeof el.select === "function") {
                    el.select();
                }
            }
        });
    }

    function moveBy(deltaRow, deltaCol) {
        const currentColIdx = colIndexByKey[effActive.colKey] ?? 0;
        let nextColIdx = currentColIdx + deltaCol;
        let nextRowIdx = effActive.rowIndex + deltaRow;

        if (nextColIdx < 0) {
            nextColIdx = COLS.length - 1;
            nextRowIdx -= 1;
        } else if (nextColIdx >= COLS.length) {
            nextColIdx = 0;
            nextRowIdx += 1;
        }

        nextRowIdx = clamp(nextRowIdx, 0, Math.max(0, rows.length - 1));
        focusCell(nextRowIdx, COLS[nextColIdx].key);
    }

    function handleKeyNav(e) {
        // TAB / SHIFT+TAB
        if (e.key === "Tab") {
            e.preventDefault();
            moveBy(0, e.shiftKey ? -1 : 1);
            return;
        }

        // ENTER -> riga successiva stessa colonna
        if (e.key === "Enter") {
            e.preventDefault();
            moveBy(1, 0);
            return;
        }

        // Frecce (stile foglio)
        if (e.key === "ArrowDown") {
            e.preventDefault();
            moveBy(1, 0);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            moveBy(-1, 0);
            return;
        }
        if (e.key === "ArrowRight") {
            // su input: solo se caret Ã¨ a fine
            // per semplicitÃ : con CTRL+ArrowRight nav
            if (e.ctrlKey) {
                e.preventDefault();
                moveBy(0, 1);
            }
            return;
        }
        if (e.key === "ArrowLeft") {
            if (e.ctrlKey) {
                e.preventDefault();
                moveBy(0, -1);
            }
            return;
        }
    }

    // Focus iniziale
    useEffect(() => {
        if (!rows || rows.length === 0) return;
        const ri = clamp(effActive.rowIndex ?? 0, 0, rows.length - 1);
        const ck = effActive.colKey ?? "title";
        // se prima volta: prova a mettere a fuoco
        requestAnimationFrame(() => {
            const el = refs.current[`${rows[ri].id}:${ck}`];
            if (el && document.activeElement !== el && typeof el.focus === "function") el.focus();
        });

    }, []);

    function isRowEmptyLike(r) {
        return r?.source === "empty" || r?.isEmpty;
    }

    function tdClass(rowIdx, colKey) {
        const active = effActive.rowIndex === rowIdx && effActive.colKey === colKey;
        return "jl-td " + (active ? "jl-cell-active" : "");
    }

    const activeRowIdx = effActive.rowIndex;

    return (
        <div className="jl-table-wrap">
            <table className="table table-bordered align-middle mb-0">
                <thead className="jl-table-head">
                <tr>
                    <th style={{ width: 240 }}>{t("Task")}</th>
                    <th style={{ width: 90 }}>{t("Asset")}</th>
                    <th style={{ width: 220 }}>{t("Status")}</th>
                    <th style={{ width: 220 }}>{t("Priority")}</th>
                    <th style={{ width: 150 }}>{t("Deadline")}</th>
                    <th style={{ width: 140 }}>{t("Owner")}</th>
                    <th>{t("Notes")}</th>
                </tr>
                </thead>

                <tbody>
                {rows.map((r, idx) => {
                    const emptyLike = isRowEmptyLike(r);
                    const disabled = readOnlyEmpty && emptyLike;

                    return (
                        <tr key={r.id} className={idx === activeRowIdx ? "jl-row-active" : ""}>
                            {/* Task */}
                            <td
                                className={tdClass(idx, "title")}
                                onMouseDown={() => focusCell(idx, "title")}
                            >
                                <input
                                    ref={(el) => setRef(r.id, "title", el)}
                                    className="jl-cell-input"
                                    placeholder={emptyLike ? "" : t("Task title")}
                                    value={r.title}
                                    disabled={disabled}
                                    onFocus={() => setActive({ rowIndex: idx, colKey: "title" })}
                                    onKeyDown={handleKeyNav}
                                    onChange={(e) => onChangeRow(idx, { ...r, title: e.target.value, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })}
                                />
                            </td>

                            {/* Asset (focusable, placeholder) */}
                            <td
                                className={tdClass(idx, "asset")}
                                onMouseDown={() => focusCell(idx, "asset")}
                            >
                                <button
                                    ref={(el) => setRef(r.id, "asset", el)}
                                    type="button"
                                    className="w-100 h-100 border-0 bg-transparent p-2 d-flex justify-content-center"
                                    onFocus={() => setActive({ rowIndex: idx, colKey: "asset" })}
                                    onKeyDown={handleKeyNav}
                                    disabled={disabled}
                                    title={t("Asset (UI placeholder)")}
                                >
                                    {r.assetUrl ? (
                                        <img className="jl-thumb" src={r.assetUrl} alt="asset" />
                                    ) : (
                                        <div
                                            className="jl-thumb d-inline-grid"
                                            style={{ placeItems: "center", fontWeight: 900, color: "rgba(0,0,0,0.35)" }}
                                        >
                                            â€”
                                        </div>
                                    )}
                                </button>
                            </td>

                            {/* Status */}
                            <td
                                className={tdClass(idx, "status")}
                                onMouseDown={() => focusCell(idx, "status")}
                            >
                                <div className="p-2">
                                    <StatusPill
                                        value={r.status}
                                        disabled={disabled}
                                        selectRef={(el) => setRef(r.id, "status", el)}
                                        onKeyDown={handleKeyNav}
                                        onChange={(v) =>
                                            onChangeRow(idx, { ...r, status: v, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })
                                        }
                                    />
                                </div>
                            </td>

                            {/* Priority */}
                            <td
                                className={tdClass(idx, "priority")}
                                onMouseDown={() => focusCell(idx, "priority")}
                            >
                                <div className="p-2">
                                    <PriorityPill
                                        value={r.priority}
                                        disabled={disabled}
                                        selectRef={(el) => setRef(r.id, "priority", el)}
                                        onKeyDown={handleKeyNav}
                                        onChange={(v) =>
                                            onChangeRow(idx, { ...r, priority: v, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })
                                        }
                                    />
                                </div>
                            </td>

                            {/* Deadline */}
                            <td
                                className={tdClass(idx, "deadline")}
                                onMouseDown={() => focusCell(idx, "deadline")}
                            >
                                <input
                                    ref={(el) => setRef(r.id, "deadline", el)}
                                    type="date"
                                    className="form-control form-control-sm border-0"
                                    style={{ padding: "8px 10px", background: "transparent" }}
                                    value={r.deadline}
                                    disabled={disabled}
                                    onFocus={() => setActive({ rowIndex: idx, colKey: "deadline" })}
                                    onKeyDown={handleKeyNav}
                                    onChange={(e) => onChangeRow(idx, { ...r, deadline: e.target.value, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })}
                                />
                            </td>

                            {/* Owner */}
                            <td
                                className={tdClass(idx, "owner")}
                                onMouseDown={() => focusCell(idx, "owner")}
                            >
                                <input
                                    ref={(el) => setRef(r.id, "owner", el)}
                                    className="form-control form-control-sm border-0"
                                    style={{ padding: "8px 10px", background: "transparent" }}
                                    value={r.owner}
                                    disabled={disabled}
                                    onFocus={() => setActive({ rowIndex: idx, colKey: "owner" })}
                                    onKeyDown={handleKeyNav}
                                    onChange={(e) => onChangeRow(idx, { ...r, owner: e.target.value, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })}
                                />
                            </td>

                            {/* Notes */}
                            <td
                                className={tdClass(idx, "notes")}
                                onMouseDown={() => focusCell(idx, "notes")}
                            >
                                <input
                                    ref={(el) => setRef(r.id, "notes", el)}
                                    className="form-control form-control-sm border-0"
                                    style={{ padding: "8px 10px", background: "transparent" }}
                                    placeholder={emptyLike ? "" : t("Add here")}
                                    value={r.notes}
                                    disabled={disabled}
                                    onFocus={() => setActive({ rowIndex: idx, colKey: "notes" })}
                                    onKeyDown={handleKeyNav}
                                    onChange={(e) => onChangeRow(idx, { ...r, notes: e.target.value, isEmpty: false, source: r.source === "empty" ? "ui" : r.source })}
                                />
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>

            <div className="p-2 small jl-muted">
                {t("Navigation: TAB/SHIFT+TAB...")}
            </div>
        </div>
    );
}
