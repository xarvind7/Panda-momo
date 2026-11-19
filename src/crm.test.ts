import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerInsights,
  buildWhatsAppMessageUrl,
  classifyCustomerTier,
  computeCrmSummary,
  customersToCsv,
  filterAndSortCustomers,
  formatRelativeVisit,
} from './crm';
import { DEFAULT_PROMOS, makeSeed, type CustomerRecord } from './data';

test('buildCustomerInsights links orders, computes spend, favorite dish, and tiers accurately', () => {
  const now = 1_700_000_000_000;
  const seed = makeSeed(true, now);
  const insights = buildCustomerInsights(seed.customers, seed.orders, seed.menu, now);

  assert.equal(insights.length, 6);

  const aarav = insights.find((i) => i.customer.phone === '9876543210');
  assert.ok(aarav);
  assert.equal(aarav.tier, 'vip');
  assert.ok(aarav.orderCount > 0);
  assert.ok(aarav.totalSpent > 0);
  assert.ok(aarav.favoriteDish !== null);
  assert.equal(aarav.loyaltyPoints, 240);

  const kabir = insights.find((i) => i.customer.phone === '9711334455');
  assert.ok(kabir);
  assert.equal(kabir.tier, 'dormant');
  assert.ok(kabir.daysSinceVisit >= 14);

  const ananya = insights.find((i) => i.customer.phone === '9654889900');
  assert.ok(ananya);
  assert.equal(ananya.tier, 'new');
});

test('classifyCustomerTier prioritizes dormant follow-up for lapsed regulars and vip for high spenders', () => {
  const now = 1_700_000_000_000;
  const base: CustomerRecord = {
    name: 'Test Guest',
    phone: '9999988888',
    table: 1,
    visits: 1,
    firstVisitAt: now - 1000,
    lastVisitAt: now - 1000,
  };
  assert.equal(classifyCustomerTier(base, 120, now), 'new');
  assert.equal(classifyCustomerTier({ ...base, visits: 2 }, 200, now), 'regular');
  assert.equal(classifyCustomerTier({ ...base, visits: 1 }, 1200, now), 'vip');
  assert.equal(classifyCustomerTier({ ...base, tags: ['VIP'] }, 0, now), 'vip');
  assert.equal(
    classifyCustomerTier(
      { ...base, visits: 4, lastVisitAt: now - 20 * 24 * 3600 * 1000 },
      800,
      now
    ),
    'dormant'
  );
});

test('filterAndSortCustomers filters by segment/search and sorts by spend or name', () => {
  const now = 1_700_000_000_000;
  const seed = makeSeed(true, now);
  const insights = buildCustomerInsights(seed.customers, seed.orders, seed.menu, now);

  const vips = filterAndSortCustomers(insights, 'vip', '', 'spend');
  assert.ok(vips.length >= 2);
  assert.ok(vips.every((i) => i.tier === 'vip'));
  assert.ok(vips[0].totalSpent >= vips[1].totalSpent);

  const byTag = filterAndSortCustomers(insights, 'all', 'corporate', 'recent');
  assert.equal(byTag.length, 1);
  assert.equal(byTag[0].customer.name, 'Rohan Malhotra');

  const byName = filterAndSortCustomers(insights, 'all', '', 'name');
  assert.equal(byName[0].customer.name, 'Aarav Verma');
});

test('computeCrmSummary calculates counts, repeat rate, and revenue totals', () => {
  const now = 1_700_000_000_000;
  const seed = makeSeed(true, now);
  const insights = buildCustomerInsights(seed.customers, seed.orders, seed.menu, now);
  const summary = computeCrmSummary(insights);

  assert.equal(summary.totalCustomers, 6);
  assert.equal(summary.vipCount + summary.regularCount + summary.dormantCount + summary.newCount, 6);
  // 5 of 6 seeded customers have visits >= 2 => 83%
  assert.equal(summary.repeatRatePct, 83);
  assert.ok(summary.totalTrackedRevenue > 0);
  assert.equal(summary.totalLoyaltyPoints, 240 + 185 + 95 + 60 + 120 + 25);
});

test('buildWhatsAppMessageUrl encodes guest first name and promo details cleanly', () => {
  const url = buildWhatsAppMessageUrl(
    { name: 'Aarav Verma', phone: '9876543210' },
    'promo',
    DEFAULT_PROMOS[0]
  );
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  const decoded = decodeURIComponent(url.split('?text=')[1]);
  assert.ok(decoded.includes('Aarav'));
  assert.ok(decoded.includes('Instagram Follow Offer'));
  assert.ok(decoded.includes('10% OFF'));
});

test('customersToCsv escapes commas and quotes and includes all columns', () => {
  const now = 1_700_000_000_000;
  const seed = makeSeed(false, now);
  const customers: CustomerRecord[] = [
    {
      name: 'Riya, Sharma',
      phone: '9876500001',
      table: 3,
      visits: 2,
      firstVisitAt: now - 3600_000,
      lastVisitAt: now - 600_000,
      tags: ['VIP', 'Chai Fan'],
      notes: 'Likes "extra" ginger, less sugar',
      loyaltyPoints: 50,
    },
  ];
  const insights = buildCustomerInsights(customers, [], seed.menu, now);
  const csv = customersToCsv(insights);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('Name,Phone,Segment'));
  assert.ok(lines[1].includes('"Riya, Sharma"'));
  assert.ok(lines[1].includes('"Likes ""extra"" ginger, less sugar"'));
  assert.equal(formatRelativeVisit(now - 5 * 60000, now), '5m pehle');
});
