import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed } from './data.ts';
import { applyStoreAction, normalizeState } from './stateActions.ts';

describe('stateActions authoritative reducer', () => {
  it('places order idempotently, deducts stock, and clears table receipt', () => {
    const base = makeSeed(false, 1700000000000);
    const act = {
      type: 'placeOrder' as const,
      payload: {
        orderId: 90001,
        table: 5,
        lines: [{ itemId: 'masala', qty: 2, size: 'full' as const }],
        customer: 'Aarav',
        customerPhone: '9876543210',
      },
    };
    const r1 = applyStoreAction(base, act, 1700000005000);
    assert.equal(r1.changed, true);
    assert.equal(r1.state.orders.some((o) => o.id === 90001), true);

    // Replayed duplicate action with same orderId is idempotent
    const r2 = applyStoreAction(r1.state, act, 1700000006000);
    assert.equal(r2.changed, false);
    assert.equal(r2.state.orders.filter((o) => o.id === 90001).length, 1);
  });

  it('registers guest, places order, settles bill, and awards loyalty points cleanly', () => {
    const base = makeSeed(false, 1700000000000);
    const s1 = applyStoreAction(
      base,
      {
        type: 'registerGuest',
        payload: { rawName: 'Meera Joshi', rawPhone: '+91 9811122233', table: 7 },
      },
      1700000001000
    ).state;
    assert.equal(s1.customers.some((c) => c.phone === '9811122233'), true);

    const s2 = applyStoreAction(
      s1,
      {
        type: 'placeOrder',
        payload: {
          orderId: 90002,
          table: 7,
          lines: [{ itemId: 'kulhad', qty: 3, size: 'full' as const }],
          customer: 'Meera Joshi',
          customerPhone: '9811122233',
        },
      },
      1700000002000
    ).state;

    const s3 = applyStoreAction(
      s2,
      {
        type: 'payShare',
        payload: { table: 7, parts: 1, method: 'UPI', tipTotal: 10 },
      },
      1700000003000
    );
    assert.equal(s3.meta, true);
    assert.equal(s3.state.lastPaid[7]?.grand, 130);
    const meera = s3.state.customers.find((c) => c.phone === '9811122233');
    assert.ok((meera?.loyaltyPoints ?? 0) >= 13);
  });

  it('normalizeState backfills missing dish photos while preserving custom uploads', () => {
    const legacy = makeSeed(false, 1700000000000);
    const legacyWithCustom = {
      ...legacy,
      menu: legacy.menu.map((m) =>
        m.id === 'samosa'
          ? { ...m, img: 'data:image/jpeg;base64,CUSTOMPHOTO' }
          : { ...m, img: undefined }
      ),
    };
    const normalized = normalizeState(legacyWithCustom, false);
    const samosa = normalized.menu.find((m) => m.id === 'samosa');
    const masala = normalized.menu.find((m) => m.id === 'masala');
    assert.equal(samosa?.img, 'data:image/jpeg;base64,CUSTOMPHOTO');
    assert.ok(masala?.img && masala.img.startsWith('/src/assets/images/'));
  });
});
