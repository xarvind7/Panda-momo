import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBurstEffect,
  dismissSakugaToast,
  getToasts,
  inferSfxFromLabel,
  showSakugaToast,
} from './sakuga';

test('inferSfxFromLabel maps Chai Pana Hinglish actions to comic SFX', () => {
  assert.equal(inferSfxFromLabel('Order bhejo · ₹95'), 'BHEJA!');
  assert.equal(inferSfxFromLabel('Banana shuru'), 'SHURU!');
  assert.equal(inferSfxFromLabel('Ready ✓'), 'READY!');
  assert.equal(inferSfxFromLabel('Served ✓'), 'SERVED!');
  assert.equal(inferSfxFromLabel('Pay ₹53'), 'PAID!');
  assert.equal(inferSfxFromLabel('Save karo'), 'SAVED!');
  assert.equal(inferSfxFromLabel('Restock'), 'FULL!');
  assert.equal(inferSfxFromLabel('Review bhejo'), 'WAH!');
});

test('createBurstEffect builds sparks, cel puffs, and optional SFX payload', () => {
  const burst = createBurstEffect(
    { x: 200, y: 300 },
    'primary',
    { sfx: 'BHEJA!', dark: false, now: 1000 }
  );
  assert.equal(burst.x, 200);
  assert.equal(burst.y, 300);
  assert.equal(burst.sfx, 'BHEJA!');
  assert.equal(burst.sparks.length, 16);
  assert.equal(burst.puffs.length, 7);
});

test('Sakuga toast queue adds and dismisses toasts cleanly', () => {
  showSakugaToast('Order sent!', 'gold', 'BHEJA!');
  const list = getToasts();
  assert.ok(list.length >= 1);
  const last = list[list.length - 1];
  assert.equal(last.message, 'Order sent!');
  assert.equal(last.sfx, 'BHEJA!');
  dismissSakugaToast(last.id);
  assert.equal(getToasts().some((t) => t.id === last.id), false);
});
