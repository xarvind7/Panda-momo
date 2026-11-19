import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Call } from './data';
import {
  appendAlertToasts,
  detectNewHelpCalls,
  formatHelpCallNotification,
  normalizeHelpKind,
  pruneResolvedToasts,
} from './staffAlerts';

describe('staffAlerts pure helpers', () => {
  it('does not report already-seen calls on subsequent checks', () => {
    const seeded: Call[] = [
      { id: 101, table: 6, kind: 'Pani', at: 1_000, done: false },
      { id: 102, table: 2, kind: 'Waiter', at: 1_100, done: true },
    ];
    const initialSeen = new Set<number>(seeded.map((c) => c.id));
    const res = detectNewHelpCalls(seeded, initialSeen);

    assert.equal(res.newCalls.length, 0);
    assert.deepEqual(Array.from(res.nextSeenIds).sort(), [101, 102]);
  });

  it('detects newly arrived open help calls in chronological order and ignores resolved calls', () => {
    const initialSeen = new Set<number>([101]);
    const calls: Call[] = [
      { id: 101, table: 6, kind: 'Pani', at: 1_000, done: false },
      { id: 104, table: 3, kind: 'Waiter', at: 2_500, done: false },
      { id: 103, table: 1, kind: 'Bill', at: 2_000, done: false },
      { id: 105, table: 4, kind: 'Tissue', at: 2_600, done: true },
    ];

    const firstPass = detectNewHelpCalls(calls, initialSeen);
    assert.deepEqual(
      firstPass.newCalls.map((c) => c.id),
      [103, 104]
    );

    const secondPass = detectNewHelpCalls(calls, firstPass.nextSeenIds);
    assert.equal(secondPass.newCalls.length, 0);
  });

  it('formats Call Waiter and specific help requests cleanly', () => {
    assert.equal(normalizeHelpKind('Waiter'), 'Call Waiter');
    assert.equal(normalizeHelpKind('  '), 'Call Waiter');
    assert.equal(normalizeHelpKind('Pani'), 'Pani');

    const waiterPayload = formatHelpCallNotification(
      { id: 201, table: 3, kind: 'Waiter', at: 3_000, done: false },
      'Sana'
    );
    assert.equal(waiterPayload.title, 'Table 3 · Call Waiter');
    assert.equal(waiterPayload.body, 'Guest called for assistance · Sana');
    assert.equal(waiterPayload.tag, 'panda-help-call-201');

    const paniPayload = formatHelpCallNotification(
      { id: 202, table: 5, kind: 'Pani', at: 3_200, done: false },
      ''
    );
    assert.equal(paniPayload.title, 'Table 5 · Pani');
    assert.equal(paniPayload.body, 'Guest requested Pani · Floor staff');
  });

  it('prunes toasts whose calls have been resolved or removed', () => {
    const toasts = [
      { id: 10, table: 2 },
      { id: 11, table: 4 },
      { id: 12, table: 6 },
    ];
    const calls: Call[] = [
      { id: 10, table: 2, kind: 'Pani', at: 100, done: true },
      { id: 11, table: 4, kind: 'Waiter', at: 200, done: false },
    ];

    const remaining = pruneResolvedToasts(toasts, calls);
    assert.deepEqual(remaining, [{ id: 11, table: 4 }]);
  });

  it('deduplicates and caps visible alert toasts', () => {
    const existing = [
      { id: 1, table: 1 },
      { id: 2, table: 2 },
    ];
    const incoming = [
      { id: 2, table: 2 },
      { id: 3, table: 3 },
      { id: 4, table: 4 },
    ];
    const merged = appendAlertToasts(existing, incoming, 3);
    assert.deepEqual(
      merged.map((t) => t.id),
      [2, 3, 4]
    );
  });
});
