import {
  BRAND,
  byId,
  formatPromoBadge,
  orderTotal,
  type CustomerRecord,
  type MenuItem,
  type Order,
  type PromoOffer,
} from './data';

export type CustomerTier = 'vip' | 'regular' | 'new' | 'dormant';
export type CustomerSegmentFilter = 'all' | CustomerTier;
export type CustomerSortKey = 'recent' | 'spend' | 'visits' | 'points' | 'name';

export const PRESET_CRM_TAGS: string[] = [
  'VIP',
  'Regular',
  'Chai Fan',
  'Spicy Lover',
  'Family',
  'Corporate',
  'Birthday Month',
];

export interface CustomerInsight {
  customer: CustomerRecord;
  tier: CustomerTier;
  tierLabel: string;
  orders: Order[];
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
  favoriteDish: string | null;
  loyaltyPoints: number;
  daysSinceVisit: number;
  tags: string[];
  notes: string;
  birthday: string;
}

export interface CrmSummary {
  totalCustomers: number;
  vipCount: number;
  regularCount: number;
  dormantCount: number;
  newCount: number;
  repeatRatePct: number;
  totalTrackedRevenue: number;
  avgCustomerLtv: number;
  totalLoyaltyPoints: number;
}

const DAY_MS = 24 * 3600 * 1000;

export function classifyCustomerTier(
  customer: CustomerRecord,
  totalSpent: number,
  now: number
): CustomerTier {
  const daysSince = Math.max(0, Math.floor((now - customer.lastVisitAt) / DAY_MS));
  const tags = customer.tags || [];
  const hasVipTag = tags.some((t) => t.trim().toLowerCase() === 'vip');

  if (daysSince >= 14 && customer.visits >= 2) {
    return 'dormant';
  }
  if (hasVipTag || customer.visits >= 5 || totalSpent >= 1000) {
    return 'vip';
  }
  if (customer.visits >= 2 || totalSpent >= 300) {
    return 'regular';
  }
  return 'new';
}

export function tierDisplayLabel(tier: CustomerTier): string {
  switch (tier) {
    case 'vip':
      return 'VIP';
    case 'regular':
      return 'Regular';
    case 'dormant':
      return 'Follow-up';
    case 'new':
      return 'New';
  }
}

export function buildCustomerInsights(
  customers: CustomerRecord[],
  orders: Order[],
  menu: MenuItem[],
  now = Date.now()
): CustomerInsight[] {
  const ordersByPhone = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.customerPhone) continue;
    const list = ordersByPhone.get(o.customerPhone) || [];
    list.push(o);
    ordersByPhone.set(o.customerPhone, list);
  }

  return customers.map((customer) => {
    const custOrders = [...(ordersByPhone.get(customer.phone) || [])].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    let totalSpent = 0;
    const dishCounts = new Map<string, number>();

    for (const o of custOrders) {
      totalSpent += orderTotal(o, menu);
      for (const l of o.lines) {
        dishCounts.set(l.itemId, (dishCounts.get(l.itemId) || 0) + l.qty);
      }
    }

    let favoriteDish: string | null = null;
    let maxQty = 0;
    for (const [itemId, qty] of dishCounts.entries()) {
      if (qty > maxQty) {
        maxQty = qty;
        favoriteDish = byId(itemId, menu).name;
      }
    }

    const orderCount = custOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;
    const computedPoints = Math.floor(totalSpent / 10) + customer.visits * 5;
    const loyaltyPoints =
      typeof customer.loyaltyPoints === 'number' && Number.isFinite(customer.loyaltyPoints)
        ? Math.max(0, Math.round(customer.loyaltyPoints))
        : computedPoints;

    const daysSinceVisit = Math.max(0, Math.floor((now - customer.lastVisitAt) / DAY_MS));
    const tier = classifyCustomerTier(customer, totalSpent, now);

    return {
      customer,
      tier,
      tierLabel: tierDisplayLabel(tier),
      orders: custOrders,
      orderCount,
      totalSpent,
      avgOrderValue,
      favoriteDish,
      loyaltyPoints,
      daysSinceVisit,
      tags: Array.isArray(customer.tags) ? customer.tags : [],
      notes: customer.notes || '',
      birthday: customer.birthday || '',
    };
  });
}

export function filterAndSortCustomers(
  insights: CustomerInsight[],
  segment: CustomerSegmentFilter,
  query: string,
  sortBy: CustomerSortKey
): CustomerInsight[] {
  const q = query.trim().toLowerCase();

  const filtered = insights.filter((item) => {
    if (segment !== 'all' && item.tier !== segment) return false;
    if (!q) return true;
    const nameMatch = item.customer.name.toLowerCase().includes(q);
    const phoneMatch = item.customer.phone.includes(q);
    const tagMatch = item.tags.some((t) => t.toLowerCase().includes(q));
    const dishMatch = (item.favoriteDish || '').toLowerCase().includes(q);
    const notesMatch = item.notes.toLowerCase().includes(q);
    return nameMatch || phoneMatch || tagMatch || dishMatch || notesMatch;
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'spend':
        return b.totalSpent - a.totalSpent || b.customer.visits - a.customer.visits;
      case 'visits':
        return b.customer.visits - a.customer.visits || b.totalSpent - a.totalSpent;
      case 'points':
        return b.loyaltyPoints - a.loyaltyPoints || b.totalSpent - a.totalSpent;
      case 'name':
        return a.customer.name.localeCompare(b.customer.name);
      case 'recent':
      default:
        return b.customer.lastVisitAt - a.customer.lastVisitAt;
    }
  });
}

export function computeCrmSummary(insights: CustomerInsight[]): CrmSummary {
  const totalCustomers = insights.length;
  let vipCount = 0;
  let regularCount = 0;
  let dormantCount = 0;
  let newCount = 0;
  let repeatCount = 0;
  let totalTrackedRevenue = 0;
  let totalLoyaltyPoints = 0;

  for (const item of insights) {
    if (item.tier === 'vip') vipCount += 1;
    else if (item.tier === 'regular') regularCount += 1;
    else if (item.tier === 'dormant') dormantCount += 1;
    else newCount += 1;

    if (item.customer.visits >= 2) repeatCount += 1;
    totalTrackedRevenue += item.totalSpent;
    totalLoyaltyPoints += item.loyaltyPoints;
  }

  return {
    totalCustomers,
    vipCount,
    regularCount,
    dormantCount,
    newCount,
    repeatRatePct: totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0,
    totalTrackedRevenue,
    avgCustomerLtv: totalCustomers > 0 ? Math.round(totalTrackedRevenue / totalCustomers) : 0,
    totalLoyaltyPoints,
  };
}

export type OutreachTemplateKind = 'promo' | 'thanks' | 'winback';

export function buildWhatsAppMessageUrl(
  customer: Pick<CustomerRecord, 'name' | 'phone'>,
  kind: OutreachTemplateKind,
  activePromo?: PromoOffer | null
): string {
  const firstName = customer.name.trim().split(/\s+/)[0] || 'Guest';
  let text = '';

  if (kind === 'promo') {
    if (activePromo) {
      const badge = formatPromoBadge(activePromo);
      text = `Namaste ${firstName}! ${BRAND} ki taraf se aapke liye special offer: "${activePromo.title}" (${badge}). Agli visit par bill par turant discount pao!`;
    } else {
      text = `Namaste ${firstName}! ${BRAND} mein aapka swagat hai. Is hafte hamare naye specials try karne zaroor aaiye!`;
    }
  } else if (kind === 'winback') {
    text = `Namaste ${firstName}! ${BRAND} mein aapko kaafi time se miss kar rahe hain. Is hafte aaiye aur garam momos & kadak chai par special welcome discount paaiye!`;
  } else {
    text = `Thank you ${firstName} ji ${BRAND} visit karne ke liye! Umeed hai aapko khana pasand aaya hoga. Phir milte hain jaldi!`;
  }

  return `https://wa.me/91${customer.phone}?text=${encodeURIComponent(text)}`;
}

export function formatRelativeVisit(ts: number, now: number): string {
  const diffMin = Math.max(0, Math.floor((now - ts) / 60000));
  if (diffMin < 1) return 'Abhi';
  if (diffMin < 60) return `${diffMin}m pehle`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h pehle`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d pehle`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function customersToCsv(insights: CustomerInsight[]): string {
  const headers = [
    'Name',
    'Phone',
    'Segment',
    'Visits',
    'Orders',
    'Total Spend (INR)',
    'Loyalty Points',
    'Favorite Dish',
    'Tags',
    'Birthday',
    'Notes',
  ];

  const rows = insights.map((item) => [
    item.customer.name,
    `+91 ${item.customer.phone}`,
    item.tierLabel,
    item.customer.visits,
    item.orderCount,
    item.totalSpent,
    item.loyaltyPoints,
    item.favoriteDish || '',
    item.tags.join('; '),
    item.birthday,
    item.notes,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}
