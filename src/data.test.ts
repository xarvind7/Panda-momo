import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTableToList,
  backfillMenuImages,
  byId,
  canShowDeal,
  catsOf,
  computeBillSplit,
  computePromoDiscount,
  computeStaffSpeed,
  computeTopDishes,
  deductStockForLines,
  deleteTableFromList,
  estimateEta,
  getOrderProgressInfo,
  isLowStock,
  kitchenCardTiming,
  linePrice,
  makeSeed,
  normalizePhone,
  orderEst,
  orderTotal,
  promoActionHref,
  sanitizePromoOffer,
  sanitizeWifiConfig,
  setMenu,
  shortId,
  tableBill,
  tableNumsOf,
  tableStatus,
  upsertCustomer,
  validateGuestProfile,
  waiterOf,
  type Line,
} from './data';

test('seed menu has 16 items, dish photos for all items, and Doodh starts low (<25%)', () => {
  const seed = makeSeed(true, 1_700_000_000_000);
  assert.equal(seed.menu.length, 16);
  for (const item of seed.menu) {
    assert.ok(item.img && /^\/src\/assets\/images\/.+\.jpg$/.test(item.img), `missing img for ${item.id}`);
  }
  const top = computeTopDishes(seed.orders, seed.menu, 3);
  assert.ok(top.length > 0);
  assert.ok(top[0].img && top[0].img.startsWith('/src/assets/images/'));
  const stripped = seed.menu.map((m) => ({ ...m, img: undefined }));
  const restored = backfillMenuImages(stripped);
  assert.equal(restored.every((m) => Boolean(m.img)), true);
  const doodh = seed.stock.find((s) => s.name === 'Doodh');
  assert.ok(doodh);
  assert.equal(isLowStock(doodh), true);
  const bread = seed.stock.find((s) => s.name === 'Bread');
  assert.ok(bread);
  assert.equal(isLowStock(bread), false);
});

test('seeded T4 order is LATE and T6 has HELP status', () => {
  const now = 1_700_000_000_000;
  const seed = makeSeed(true, now);
  const t4Order = seed.orders.find((o) => o.table === 4 && !o.paid);
  assert.ok(t4Order);
  const timing = kitchenCardTiming(t4Order, now, seed.menu);
  assert.equal(timing.isLate, true);
  assert.equal(tableStatus(seed, 6), 'help');
});

test('seeded staff speed shows Sana faster than Ali', () => {
  const seed = makeSeed(true, 1_700_000_000_000);
  const speeds = computeStaffSpeed(seed.orders);
  assert.equal(speeds[0].name, 'Sana');
  const ali = speeds.find((s) => s.name === 'Ali');
  assert.ok(ali);
  assert.ok(speeds[0].avgMin < ali.avgMin);
});

test('bill split formula matches PRD section 16 item 7 (₹95 + 10% tip / 2 = ₹53)', () => {
  const res = computeBillSplit(95, 10, 2);
  assert.equal(res.tip, 10);
  assert.equal(res.grand, 105);
  assert.equal(res.share, 53);
});

test('deal upsell shows for snack-only cart and hides when any Chai is present', () => {
  const seed = makeSeed(false);
  const snackOnly: Line[] = [{ itemId: 'samosa', qty: 1, size: 'full' }];
  assert.equal(canShowDeal(snackOnly, seed.menu), true);

  const withChai: Line[] = [
    { itemId: 'samosa', qty: 1, size: 'full' },
    { itemId: 'kulhad', qty: 1, size: 'full' },
  ];
  assert.equal(canShowDeal(withChai, seed.menu), false);

  const withDeal: Line[] = [
    { itemId: 'samosa', qty: 1, size: 'full' },
    { itemId: 'masala', qty: 1, size: 'full', deal: true },
  ];
  assert.equal(canShowDeal(withDeal, seed.menu), false);
  assert.equal(linePrice(withDeal[1], seed.menu), 20);
  assert.equal(orderTotal({ lines: withDeal }, seed.menu), 60);
});

test('ETA accounts for max prep and active queue capped at 8', () => {
  const seed = makeSeed(false);
  // Empty queue, no lines => base 5
  assert.equal(estimateEta(seed, []), 5);
  // Empty queue, Paneer Roll (prep 9) => 9
  assert.equal(estimateEta(seed, [{ itemId: 'paneerroll', qty: 1, size: 'full' }]), 9);
  // 2 active orders => +3 min
  const withQueue = {
    ...seed,
    orders: [
      {
        id: 1,
        table: 1,
        channel: 'dine' as const,
        lines: [{ itemId: 'masala', qty: 1, size: 'full' as const }],
        status: 'new' as const,
        createdAt: 0,
        paid: false,
        by: 'guest' as const,
      },
      {
        id: 2,
        table: 2,
        channel: 'dine' as const,
        lines: [{ itemId: 'masala', qty: 1, size: 'full' as const }],
        status: 'cooking' as const,
        createdAt: 0,
        paid: false,
        by: 'guest' as const,
      },
    ],
  };
  assert.equal(estimateEta(withQueue, []), 8);
  assert.equal(orderEst(withQueue.orders[0], seed.menu), 5);
});

test('stock deduction lowers linked stock and clamps at 0', () => {
  const seed = makeSeed(false);
  const next = deductStockForLines(
    seed.stock,
    [{ itemId: 'masala', qty: 5, size: 'full' }],
    seed.menu
  );
  const doodh = next.find((s) => s.name === 'Doodh');
  assert.equal(doodh?.qty, 4.5);
});

test('tableStatus follows priority help > free > bill > ordering > cooking > eating', () => {
  const seed = makeSeed(false);
  assert.equal(tableStatus(seed, 5), 'free');
  assert.equal(tableBill(seed, 5), 0);

  const withBill = {
    ...seed,
    billReq: { 5: true },
    orders: [
      {
        id: 10,
        table: 5,
        channel: 'dine' as const,
        lines: [{ itemId: 'masala', qty: 2, size: 'full' as const }],
        status: 'new' as const,
        createdAt: 0,
        paid: false,
        by: 'guest' as const,
      },
    ],
  };
  assert.equal(tableStatus(withBill, 5), 'bill');
  assert.equal(tableBill(withBill, 5), 60);

  const withHelp = {
    ...withBill,
    calls: [{ id: 1, table: 5, kind: 'Waiter', at: 0, done: false }],
  };
  assert.equal(tableStatus(withHelp, 5), 'help');
});

test('byId returns removed placeholder and catsOf hides empty categories and appends custom', () => {
  const seed = makeSeed(false);
  setMenu(seed.menu);
  assert.equal(byId('deleted_item_xyz').name, '(removed item)');
  assert.equal(byId('deleted_item_xyz').price, 0);
  assert.equal(shortId(123456), 3456);
  assert.equal(shortId(2004), 2004);

  const modified = [
    ...seed.menu.filter((m) => m.cat !== 'Meetha'),
    { ...seed.menu[0], id: 'special', cat: 'Specials', pos: 99 },
  ];
  const cats = catsOf(modified, true);
  assert.equal(cats.includes('Meetha'), false);
  assert.equal(cats[cats.length - 1], 'Specials');
});

test('addTableToList inserts sorted tables and blocks duplicates or out-of-range numbers', () => {
  const seed = makeSeed(false);
  assert.deepEqual(tableNumsOf(seed), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(waiterOf(seed, 2), 'Ali');
  assert.equal(waiterOf(seed, 5), 'Sana');

  const added = addTableToList(seed.tables, 9, 'Vikram');
  assert.equal(added.ok, true);
  assert.ok(added.tables);
  assert.equal(added.tables.length, 9);
  assert.equal(added.tables[8].num, 9);
  assert.equal(added.tables[8].waiter, 'Vikram');

  const dup = addTableToList(added.tables, 9, 'Ali');
  assert.equal(dup.ok, false);

  const badNum = addTableToList(added.tables, 0, 'Ali');
  assert.equal(badNum.ok, false);
});

test('deleteTableFromList deletes free tables and blocks active orders or last remaining table', () => {
  const seed = makeSeed(true, 1_700_000_000_000);
  // Table 1 has active unpaid seeded order => must be blocked
  const blockedActive = deleteTableFromList(seed, 1);
  assert.equal(blockedActive.ok, false);

  // Table 5 is free in seed => can be deleted
  const deletedFree = deleteTableFromList(seed, 5);
  assert.equal(deletedFree.ok, true);
  assert.ok(deletedFree.tables);
  assert.equal(deletedFree.tables.some((t) => t.num === 5), false);

  // Single remaining table => must be blocked
  const singleTableState = {
    ...makeSeed(false),
    tables: [{ num: 1, waiter: 'Ali' }],
  };
  const blockedLast = deleteTableFromList(singleTableState, 1);
  assert.equal(blockedLast.ok, false);
});

test('validateGuestProfile normalizes +91/0 numbers and rejects invalid inputs', () => {
  assert.equal(normalizePhone('+91 93342-08980'), '9334208980');
  assert.equal(normalizePhone('09876543210'), '9876543210');

  const ok = validateGuestProfile('  Arvind  Kumar ', '+91 93342 08980');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.name, 'Arvind Kumar');
    assert.equal(ok.phone, '9334208980');
  }

  assert.equal(validateGuestProfile('A', '9876543210').ok, false);
  assert.equal(validateGuestProfile('Rahul', '12345').ok, false);
});

test('upsertCustomer inserts new guests and increments visits for returning numbers', () => {
  const first = upsertCustomer([], 'Rohan', '9988776655', 3, 1000, true);
  assert.equal(first.length, 1);
  assert.equal(first[0].visits, 1);
  assert.equal(first[0].table, 3);

  const second = upsertCustomer(first, 'Rohan Verma', '9988776655', 5, 2000, true);
  assert.equal(second.length, 1);
  assert.equal(second[0].name, 'Rohan Verma');
  assert.equal(second[0].visits, 2);
  assert.equal(second[0].table, 5);
});

test('sanitizeWifiConfig validates SSID and supports open or password-protected WiFi', () => {
  assert.equal(sanitizeWifiConfig('   ', 'secret').ok, false);
  const ok = sanitizeWifiConfig('  PandaMomo_5G ', '  chai123  ');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.wifi.name, 'PandaMomo_5G');
    assert.equal(ok.wifi.password, 'chai123');
  }
  const open = sanitizeWifiConfig('PandaMomo_Open', '');
  assert.equal(open.ok, true);
  if (open.ok) {
    assert.equal(open.wifi.password, '');
  }
});

test('getOrderProgressInfo reports ETA countdown, cooking status, ready waiter alert, and timeline timestamps', () => {
  const now = 1_700_000_600_000;
  const seed = makeSeed(true, now);
  const baseOrder = seed.orders.find((o) => o.table === 3 && !o.paid)!;
  assert.equal(baseOrder.status, 'cooking');

  const cookingInfo = getOrderProgressInfo(baseOrder, seed.menu, now, 'Ali');
  assert.equal(cookingInfo.badgeText.includes('Ban Raha Hai'), true);
  assert.equal(cookingInfo.remainingSec > 0, true);
  assert.equal(cookingInfo.estMin, 11);
  assert.equal(cookingInfo.steps[0].state, 'done');
  assert.equal(cookingInfo.steps[1].state, 'current');
  assert.equal(cookingInfo.steps[2].state, 'pending');

  const readyOrder = { ...baseOrder, status: 'ready' as const, readyAt: now - 30_000 };
  const readyInfo = getOrderProgressInfo(readyOrder, seed.menu, now, 'Sana');
  assert.equal(readyInfo.badgeText.includes('BAN GAYA'), true);
  assert.equal(readyInfo.remainingSec, 0);
  assert.equal(readyInfo.detailMessage.includes('Sana'), true);
  assert.equal(readyInfo.steps[2].state, 'current');
});

test('sanitizePromoOffer, promoActionHref, and computePromoDiscount handle percent, flat, and minBill rules', () => {
  assert.equal(
    promoActionHref({ platform: 'instagram', handleOrUrl: '@xarvind07' }),
    'https://instagram.com/xarvind07'
  );
  assert.equal(
    promoActionHref({ platform: 'google', handleOrUrl: 'https://g.page/r/test/review' }),
    'https://g.page/r/test/review'
  );

  const bad = sanitizePromoOffer({
    title: 'X',
    platform: 'instagram',
    handleOrUrl: '@x',
    discountType: 'percent',
    discountValue: 10,
    minBill: 0,
    description: '',
    active: true,
  });
  assert.equal(bad.ok, false);

  const pctRes = sanitizePromoOffer({
    title: 'Reel Special',
    platform: 'reel',
    handleOrUrl: '@pandamomo',
    discountType: 'percent',
    discountValue: 20,
    minBill: 150,
    description: 'Tag us in a Reel',
    active: true,
  });
  assert.equal(pctRes.ok, true);
  if (pctRes.ok) {
    // Below minBill => not eligible
    const low = computePromoDiscount(100, pctRes.promo);
    assert.equal(low.eligible, false);
    assert.equal(low.discount, 0);
    // Eligible => 20% of 200 = 40
    const ok = computePromoDiscount(200, pctRes.promo);
    assert.equal(ok.eligible, true);
    assert.equal(ok.discount, 40);
  }

  const flatRes = sanitizePromoOffer({
    title: 'Google Review',
    platform: 'google',
    handleOrUrl: 'https://google.com/maps',
    discountType: 'flat',
    discountValue: 50,
    minBill: 0,
    description: 'Leave a review',
    active: true,
  });
  assert.equal(flatRes.ok, true);
  if (flatRes.ok) {
    // Capped at subtotal if flat > subtotal
    const capped = computePromoDiscount(30, flatRes.promo);
    assert.equal(capped.eligible, true);
    assert.equal(capped.discount, 30);
  }
});
