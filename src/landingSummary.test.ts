import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed } from './data';
import { buildMasterQrUrl, buildTableQrUrl, computeLandingSummary } from './landingSummary';

describe('landingSummary pure helpers', () => {
  it('computes accurate table availability, dish count, kitchen queue, and help calls', () => {
    const seeded = makeSeed(false, Date.now());
    seeded.orders.push({
      id: 9001,
      table: 2,
      channel: 'dine',
      lines: [{ itemId: seeded.menu[0].id, qty: 2, size: 'full' }],
      status: 'cooking',
      createdAt: Date.now() - 60_000,
      paid: false,
      by: 'guest',
    });
    seeded.calls.push({
      id: 9002,
      table: 6,
      kind: 'Pani',
      at: Date.now() - 30_000,
      done: false,
    });

    const summary = computeLandingSummary(seeded);

    assert.equal(summary.totalTables, 8);
    assert.equal(summary.freeTables, 6);
    assert.equal(summary.busyTables, 2);
    assert.equal(summary.freeTables + summary.busyTables, summary.totalTables);
    assert.equal(summary.availableDishes, seeded.menu.filter((m) => m.available).length);
    assert.equal(summary.openHelpCalls, 1);
    assert.equal(summary.activeKitchenOrders, 1);
    assert.ok(summary.liveEtaMin >= 4);
  });

  it('builds a clean single universal QR target URL pointing to #/m', () => {
    assert.equal(
      buildMasterQrUrl('https://pandamomo.in/', '/'),
      'https://pandamomo.in/#/m'
    );
    assert.equal(
      buildMasterQrUrl('http://localhost:3000', '/cafe/'),
      'http://localhost:3000/cafe/#/m'
    );
  });

  it('builds table-specific QR target URLs pointing to #/t/<tableNum> and strips /admin', () => {
    assert.equal(
      buildTableQrUrl('https://pandamomo.in/', '/', 5),
      'https://pandamomo.in/#/t/5'
    );
    assert.equal(
      buildTableQrUrl('http://localhost:3000', '/admin', 10),
      'http://localhost:3000/#/t/10'
    );
    assert.equal(
      buildTableQrUrl('http://localhost:3000', '/cafe/', 3),
      'http://localhost:3000/cafe/#/t/3'
    );
  });
});
