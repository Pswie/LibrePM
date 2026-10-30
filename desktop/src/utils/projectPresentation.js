/** Task API responses use statusName; older desktop data may still carry status. */
export function summarizeProjectTasks(tasks, now = new Date()) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return tasks.reduce((summary, task) => {
        const status = String(task.statusName || task.status?.name || task.status || '').toUpperCase();
        summary.total += 1;
        if (status === 'DONE') summary.done += 1;
        if (task.deadline && String(task.deadline).slice(0, 10) < today && !['DONE', 'CANCELLED'].includes(status)) summary.overdue += 1;
        return summary;
    }, { total: 0, done: 0, overdue: 0 });
}
