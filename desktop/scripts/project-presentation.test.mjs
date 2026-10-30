import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjectTasks } from '../src/utils/projectPresentation.js';

test('project cards count the real API statusName and do not mark completed tasks overdue', () => {
    const actual = summarizeProjectTasks([
        { statusName: 'DONE', deadline: '2026-01-01' },
        { statusName: 'IN_PROGRESS', deadline: '2026-01-01' },
        { statusName: 'TODO', deadline: '2026-10-30' },
    ], new Date(2026, 9, 30, 16));
    assert.deepEqual(actual, { total: 3, done: 1, overdue: 1 });
});

test('cancelled work is not counted as late and deadline is a calendar date', () => {
    const actual = summarizeProjectTasks([
        { statusName: 'CANCELLED', deadline: '2026-01-01' },
        { statusName: 'TODO', deadline: '2026-10-30' },
        { statusName: 'TODO', deadline: null },
    ], new Date(2026, 9, 30, 23, 59));
    assert.deepEqual(actual, { total: 3, done: 0, overdue: 0 });
});

test('older desktop status shapes remain compatible', () => {
    assert.deepEqual(summarizeProjectTasks([
        { status: 'DONE' }, { status: { name: 'DONE' } },
    ]), { total: 2, done: 2, overdue: 0 });
});
