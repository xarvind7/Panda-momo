import {
  addTableToList,
  backfillMenuImages,
  byId,
  computePromoDiscount,
  deductStockForLines,
  DEFAULT_PROMOS,
  DEFAULT_TABLES,
  DEFAULT_WIFI,
  deleteTableFromList,
  estimateEta,
  linePrice,
  makeSeed,
  nid,
  round2,
  sanitizePromoOffer,
  sanitizeWifiConfig,
  tableBill,
  tableOrders,
  upsertCustomer,
  validateGuestProfile,
  waiterOf,
  type CustomerRecord,
  type Line,
  type MenuItem,
  type Order,
  type PaidReceipt,
  type PromoOffer,
  type PromoPlatform,
  type State,
  type Status,
  type StockItem,
} from './data.ts';

export type StoreAction =
  | {
      type: 'registerGuest';
      payload: {
        rawName: string;
        rawPhone: string;
        table: number | null;
        incrementVisit?: boolean;
      };
    }
  | {
      type: 'addCustomerManual';
      payload: {
        name: string;
        phone: string;
        tags?: string[];
        notes?: string;
        birthday?: string;
        loyaltyPoints?: number;
      };
    }
  | {
      type: 'updateCustomerProfile';
      payload: {
        phone: string;
        patch: {
          name?: string;
          tags?: string[];
          notes?: string;
          birthday?: string;
        };
      };
    }
  | {
      type: 'adjustCustomerPoints';
      payload: { phone: string; delta: number; baseFallback?: number };
    }
  | { type: 'recordCustomerVisit'; payload: { phone: string } }
  | { type: 'deleteCustomerRecord'; payload: { phone: string } }
  | {
      type: 'placeOrder';
      payload: {
        orderId?: number;
        table: number | null;
        lines: Line[];
        by?: 'guest' | 'waiter' | 'whatsapp';
        channel?: 'dine' | 'whatsapp';
        customer?: string;
        customerPhone?: string;
      };
    }
  | {
      type: 'setOrderStatus';
      payload: { orderId: number; status: Status; actor?: string };
    }
  | {
      type: 'callWaiter';
      payload: { callId?: number; table: number; kind: string };
    }
  | { type: 'resolveCall'; payload: { callId: number } }
  | {
      type: 'payShare';
      payload: {
        table: number;
        parts: number;
        method: string;
        tipTotal: number;
        promoId?: string | null;
      };
    }
  | {
      type: 'addReview';
      payload: { table: number; stars: number; text: string };
    }
  | {
      type: 'saveMenuItem';
      payload: Omit<MenuItem, 'id' | 'pos'> & { id?: string; pos?: number };
    }
  | { type: 'toggleMenuAvailable'; payload: { id: string } }
  | { type: 'deleteMenuItem'; payload: { id: string } }
  | { type: 'updateStockQty'; payload: { name: string; qty: number } }
  | { type: 'restockItem'; payload: { name: string } }
  | { type: 'addStockItem'; payload: { item: StockItem } }
  | { type: 'deleteStockItem'; payload: { name: string } }
  | { type: 'addTable'; payload: { num: number; waiter: string } }
  | { type: 'deleteTable'; payload: { num: number } }
  | { type: 'updateWifi'; payload: { rawName: string; rawPassword: string } }
  | {
      type: 'savePromoOffer';
      payload: {
        id?: string;
        title: string;
        platform: PromoPlatform;
        handleOrUrl: string;
        discountType: 'percent' | 'flat';
        discountValue: number;
        minBill: number;
        description: string;
        active: boolean;
      };
    }
  | { type: 'togglePromoActive'; payload: { id: string } }
  | { type: 'deletePromoOffer'; payload: { id: string } }
  | { type: 'clearOrdersAndCalls' }
  | { type: 'resetDemo' };

export function normalizeState(raw: unknown, demoFallback = true): State {
  const fallback = makeSeed(demoFallback);
  if (!raw || typeof raw !== 'object') return fallback;
  const parsed = raw as Partial<State>;
  if (!Array.isArray(parsed.menu) || parsed.menu.length === 0) return fallback;

  return {
    menu: backfillMenuImages(parsed.menu),
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    calls: Array.isArray(parsed.calls) ? parsed.calls : [],
    stock: Array.isArray(parsed.stock) ? parsed.stock : fallback.stock,
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    tables:
      Array.isArray(parsed.tables) && parsed.tables.length > 0
        ? parsed.tables
        : DEFAULT_TABLES.map((t) => ({ ...t })),
    customers: Array.isArray(parsed.customers) ? parsed.customers : fallback.customers,
    wifi:
      parsed.wifi && typeof parsed.wifi.name === 'string' && parsed.wifi.name.trim()
        ? {
            name: parsed.wifi.name.trim(),
            password: typeof parsed.wifi.password === 'string' ? parsed.wifi.password : '',
          }
        : { ...DEFAULT_WIFI },
    promos: Array.isArray(parsed.promos)
      ? parsed.promos
      : DEFAULT_PROMOS.map((p) => ({ ...p })),
    dayStart: typeof parsed.dayStart === 'number' ? parsed.dayStart : fallback.dayStart,
    billReq: parsed.billReq && typeof parsed.billReq === 'object' ? parsed.billReq : {},
    part: parsed.part && typeof parsed.part === 'object' ? parsed.part : {},
    lastPaid: parsed.lastPaid && typeof parsed.lastPaid === 'object' ? parsed.lastPaid : {},
  };
}

export interface ActionResult {
  state: State;
  changed: boolean;
  error?: string;
  meta?: unknown;
}

export function applyStoreAction(
  s: State,
  action: StoreAction,
  now = Date.now()
): ActionResult {
  switch (action.type) {
    case 'registerGuest': {
      const checked = validateGuestProfile(
        action.payload.rawName,
        action.payload.rawPhone
      );
      if (!checked.ok) {
        return { state: s, changed: false, error: checked.error, meta: checked };
      }
      const next: State = {
        ...s,
        customers: upsertCustomer(
          s.customers || [],
          checked.name,
          checked.phone,
          action.payload.table,
          now,
          action.payload.incrementVisit ?? true
        ),
      };
      return { state: next, changed: true, meta: checked };
    }

    case 'addCustomerManual': {
      const input = action.payload;
      const checked = validateGuestProfile(input.name, input.phone);
      if (!checked.ok) {
        return { state: s, changed: false, error: checked.error, meta: checked };
      }

      const cleanTags = Array.from(
        new Set((input.tags || []).map((t) => t.trim()).filter(Boolean))
      ).slice(0, 8);
      const cleanNotes = (input.notes || '').trim().slice(0, 300);
      const cleanBirthday = (input.birthday || '').trim();
      const initialPoints = Math.max(0, Math.round(Number(input.loyaltyPoints) || 0));

      const list = s.customers || [];
      const existing = list.find((c) => c.phone === checked.phone);
      if (existing) {
        const mergedTags = Array.from(
          new Set([...(existing.tags || []), ...cleanTags])
        ).slice(0, 8);
        const updated: CustomerRecord = {
          ...existing,
          name: checked.name,
          tags: mergedTags,
          notes: cleanNotes || existing.notes,
          birthday: cleanBirthday || existing.birthday,
          loyaltyPoints:
            typeof existing.loyaltyPoints === 'number'
              ? existing.loyaltyPoints + initialPoints
              : initialPoints,
          lastVisitAt: now,
        };
        return {
          state: {
            ...s,
            customers: list.map((c) => (c.phone === checked.phone ? updated : c)),
          },
          changed: true,
          meta: { ok: true, customer: updated },
        };
      }

      const created: CustomerRecord = {
        name: checked.name,
        phone: checked.phone,
        table: null,
        visits: 1,
        firstVisitAt: now,
        lastVisitAt: now,
        tags: cleanTags,
        notes: cleanNotes,
        birthday: cleanBirthday,
        loyaltyPoints: initialPoints,
      };
      return {
        state: {
          ...s,
          customers: [created, ...list],
        },
        changed: true,
        meta: { ok: true, customer: created },
      };
    }

    case 'updateCustomerProfile': {
      const { phone, patch } = action.payload;
      return {
        state: {
          ...s,
          customers: (s.customers || []).map((c) => {
            if (c.phone !== phone) return c;
            const nextName =
              typeof patch.name === 'string' && patch.name.trim().length >= 2
                ? patch.name.trim().replace(/\s+/g, ' ')
                : c.name;
            const nextTags = Array.isArray(patch.tags)
              ? Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 8)
              : c.tags;
            const nextNotes =
              typeof patch.notes === 'string' ? patch.notes.trim().slice(0, 300) : c.notes;
            const nextBirthday =
              typeof patch.birthday === 'string' ? patch.birthday.trim() : c.birthday;
            return {
              ...c,
              name: nextName,
              tags: nextTags,
              notes: nextNotes,
              birthday: nextBirthday,
            };
          }),
        },
        changed: true,
      };
    }

    case 'adjustCustomerPoints': {
      const { phone, delta, baseFallback = 0 } = action.payload;
      return {
        state: {
          ...s,
          customers: (s.customers || []).map((c) => {
            if (c.phone !== phone) return c;
            const current =
              typeof c.loyaltyPoints === 'number' && Number.isFinite(c.loyaltyPoints)
                ? c.loyaltyPoints
                : baseFallback;
            return {
              ...c,
              loyaltyPoints: Math.max(0, Math.round(current + delta)),
            };
          }),
        },
        changed: true,
      };
    }

    case 'recordCustomerVisit': {
      const { phone } = action.payload;
      return {
        state: {
          ...s,
          customers: (s.customers || []).map((c) => {
            if (c.phone !== phone) return c;
            const pts =
              typeof c.loyaltyPoints === 'number' && Number.isFinite(c.loyaltyPoints)
                ? c.loyaltyPoints
                : 0;
            return {
              ...c,
              visits: c.visits + 1,
              lastVisitAt: now,
              loyaltyPoints: pts + 5,
            };
          }),
        },
        changed: true,
      };
    }

    case 'deleteCustomerRecord': {
      return {
        state: {
          ...s,
          customers: (s.customers || []).filter((c) => c.phone !== action.payload.phone),
        },
        changed: true,
      };
    }

    case 'placeOrder': {
      const {
        orderId,
        table,
        lines,
        by = 'guest',
        channel = 'dine',
        customer,
        customerPhone,
      } = action.payload;
      const cleanLines = (lines || [])
        .filter((l) => l.qty > 0)
        .map((l) => ({ ...l, size: 'full' as const }));
      if (cleanLines.length === 0) {
        return { state: s, changed: false, error: 'Order mein kam se kam 1 item hona chahiye.' };
      }

      const id = orderId ?? nid();
      const existing = s.orders.find((o) => o.id === id);
      if (existing) {
        return { state: s, changed: false, meta: existing };
      }

      const order: Order = {
        id,
        table,
        channel,
        customer,
        customerPhone,
        lines: cleanLines,
        status: 'new',
        createdAt: now,
        etaMin: estimateEta(s, cleanLines),
        paid: false,
        by,
      };
      const nextStock = deductStockForLines(s.stock, cleanLines, s.menu);
      const nextLastPaid = { ...s.lastPaid };
      if (table !== null) {
        delete nextLastPaid[table];
      }
      return {
        state: {
          ...s,
          orders: [...s.orders, order],
          stock: nextStock,
          lastPaid: nextLastPaid,
        },
        changed: true,
        meta: order,
      };
    }

    case 'setOrderStatus': {
      const { orderId, status, actor } = action.payload;
      return {
        state: {
          ...s,
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const patch: Partial<Order> = { status };
            if (status === 'cooking' && !o.cookingAt) patch.cookingAt = now;
            if (status === 'ready') {
              if (!o.cookingAt) patch.cookingAt = now;
              patch.readyAt = now;
            }
            if (status === 'served') {
              if (!o.cookingAt) patch.cookingAt = now;
              if (!o.readyAt) patch.readyAt = now;
              patch.servedAt = now;
              patch.servedBy =
                actor || (o.table !== null ? waiterOf(s, o.table) : 'Admin');
            }
            return { ...o, ...patch };
          }),
        },
        changed: true,
      };
    }

    case 'callWaiter': {
      const { callId, table, kind } = action.payload;
      const id = callId ?? nid();
      if (s.calls.some((c) => c.id === id)) {
        return { state: s, changed: false };
      }
      const filtered = s.calls.filter(
        (c) => !(c.table === table && !c.done && c.kind === kind)
      );
      const nextBillReq = kind === 'Bill' ? { ...s.billReq, [table]: true } : s.billReq;
      return {
        state: {
          ...s,
          calls: [...filtered, { id, table, kind, at: now, done: false }],
          billReq: nextBillReq,
        },
        changed: true,
      };
    }

    case 'resolveCall': {
      return {
        state: {
          ...s,
          calls: s.calls.map((c) =>
            c.id === action.payload.callId ? { ...c, done: true } : c
          ),
        },
        changed: true,
      };
    }

    case 'payShare': {
      const { table, parts, method, tipTotal, promoId } = action.payload;
      const unpaid = tableOrders(s, table);
      if (unpaid.length === 0) {
        return { state: s, changed: false, meta: false };
      }

      const currentPaidParts = s.part[table] ?? 0;
      const nextPaidParts = currentPaidParts + 1;

      if (nextPaidParts < parts) {
        return {
          state: {
            ...s,
            part: { ...s.part, [table]: nextPaidParts },
          },
          changed: true,
          meta: false,
        };
      }

      const total = tableBill(s, table);
      const activePromo = promoId ? s.promos.find((p) => p.id === promoId) : undefined;
      const promoCalc = computePromoDiscount(total, activePromo);
      const discount = promoCalc.eligible ? promoCalc.discount : 0;
      const netTotal = Math.max(0, total - discount);
      const unpaidIds = new Set(unpaid.map((o) => o.id));
      const perOrderTip = unpaid.length > 0 ? Math.round(tipTotal / unpaid.length) : 0;

      let assigned = 0;
      const nextOrders = s.orders.map((o) => {
        if (!unpaidIds.has(o.id)) return o;
        assigned += 1;
        const tipForOrder =
          assigned === unpaid.length
            ? Math.max(0, tipTotal - perOrderTip * (unpaid.length - 1))
            : perOrderTip;
        return {
          ...o,
          paid: true,
          paidAt: now,
          method,
          tip: tipForOrder,
        };
      });

      const nextCalls = s.calls.map((c) =>
        c.table === table && !c.done ? { ...c, done: true } : c
      );
      const nextPart = { ...s.part };
      delete nextPart[table];
      const nextBillReq = { ...s.billReq };
      delete nextBillReq[table];

      const receiptItems = unpaid.flatMap((o) =>
        o.lines.map((l) => ({
          name: byId(l.itemId, s.menu).name,
          qty: l.qty,
          amount: linePrice(l, s.menu),
          deal: l.deal,
        }))
      );
      const firstWithCustomer = unpaid.find((o) => o.customer || o.customerPhone);
      const receipt: PaidReceipt = {
        total,
        discount: discount > 0 ? discount : undefined,
        promoTitle: discount > 0 && activePromo ? activePromo.title : undefined,
        tip: tipTotal,
        grand: netTotal + tipTotal,
        method,
        txnId: `TXN-${String(now).slice(-8)}`,
        customerName: firstWithCustomer?.customer,
        customerPhone: firstWithCustomer?.customerPhone,
        items: receiptItems,
        at: now,
      };

      const earnedPoints = Math.max(1, Math.floor((netTotal + tipTotal) / 10));
      const nextCustomers = firstWithCustomer?.customerPhone
        ? (s.customers || []).map((c) =>
            c.phone === firstWithCustomer.customerPhone
              ? {
                  ...c,
                  loyaltyPoints:
                    (typeof c.loyaltyPoints === 'number' ? c.loyaltyPoints : 0) + earnedPoints,
                  lastVisitAt: now,
                }
              : c
          )
        : s.customers;

      return {
        state: {
          ...s,
          orders: nextOrders,
          calls: nextCalls,
          customers: nextCustomers,
          part: nextPart,
          billReq: nextBillReq,
          lastPaid: {
            ...s.lastPaid,
            [table]: receipt,
          },
        },
        changed: true,
        meta: true,
      };
    }

    case 'addReview': {
      return {
        state: {
          ...s,
          reviews: [
            ...s.reviews,
            {
              table: action.payload.table,
              stars: Math.max(1, Math.min(5, Math.round(action.payload.stars))),
              text: action.payload.text.trim(),
              at: now,
            },
          ],
        },
        changed: true,
      };
    }

    case 'saveMenuItem': {
      const item = action.payload;
      const existing = item.id ? s.menu.find((m) => m.id === item.id) : undefined;
      if (existing) {
        const updated: MenuItem = {
          ...existing,
          ...item,
          id: existing.id,
          pos: existing.pos,
        };
        return {
          state: {
            ...s,
            menu: s.menu.map((m) => (m.id === existing.id ? updated : m)),
          },
          changed: true,
          meta: updated,
        };
      }
      const maxPos = s.menu.reduce((max, m) => Math.max(max, m.pos), -1);
      const created: MenuItem = {
        ...item,
        id: item.id || 'i' + now.toString(36),
        pos: typeof item.pos === 'number' ? item.pos : maxPos + 1,
      };
      return {
        state: {
          ...s,
          menu: [...s.menu, created],
        },
        changed: true,
        meta: created,
      };
    }

    case 'toggleMenuAvailable': {
      return {
        state: {
          ...s,
          menu: s.menu.map((m) =>
            m.id === action.payload.id ? { ...m, available: !m.available } : m
          ),
        },
        changed: true,
      };
    }

    case 'deleteMenuItem': {
      return {
        state: {
          ...s,
          menu: s.menu.filter((m) => m.id !== action.payload.id),
        },
        changed: true,
      };
    }

    case 'updateStockQty': {
      return {
        state: {
          ...s,
          stock: s.stock.map((st) =>
            st.name === action.payload.name
              ? { ...st, qty: Math.max(0, round2(action.payload.qty)) }
              : st
          ),
        },
        changed: true,
      };
    }

    case 'restockItem': {
      return {
        state: {
          ...s,
          stock: s.stock.map((st) =>
            st.name === action.payload.name ? { ...st, qty: st.max } : st
          ),
        },
        changed: true,
      };
    }

    case 'addStockItem': {
      const item = action.payload.item;
      const cleanName = item.name.trim();
      if (!cleanName) return { state: s, changed: false, error: 'Naam daalo.' };
      if (item.max <= 0) {
        return { state: s, changed: false, error: 'Full stock > 0 hona chahiye.' };
      }
      const dup = s.stock.some((st) => st.name.toLowerCase() === cleanName.toLowerCase());
      if (dup) return { state: s, changed: false, error: 'Ye stock item pehle se hai.' };

      return {
        state: {
          ...s,
          stock: [
            ...s.stock,
            {
              name: cleanName,
              qty: Math.max(0, round2(item.qty)),
              max: Math.max(1, round2(item.max)),
              unit: item.unit.trim() || 'pcs',
            },
          ],
        },
        changed: true,
        meta: { ok: true },
      };
    }

    case 'deleteStockItem': {
      return {
        state: {
          ...s,
          stock: s.stock.filter((st) => st.name !== action.payload.name),
        },
        changed: true,
      };
    }

    case 'addTable': {
      const res = addTableToList(s.tables, action.payload.num, action.payload.waiter);
      if (!res.ok) return { state: s, changed: false, error: res.error, meta: res };
      return {
        state: { ...s, tables: res.tables },
        changed: true,
        meta: { ok: true },
      };
    }

    case 'deleteTable': {
      const num = action.payload.num;
      const res = deleteTableFromList(s, num);
      if (!res.ok) return { state: s, changed: false, error: res.error, meta: res };
      const nextCalls = s.calls.map((c) => (c.table === num ? { ...c, done: true } : c));
      const nextBillReq = { ...s.billReq };
      delete nextBillReq[num];
      const nextPart = { ...s.part };
      delete nextPart[num];
      const nextLastPaid = { ...s.lastPaid };
      delete nextLastPaid[num];
      return {
        state: {
          ...s,
          tables: res.tables,
          calls: nextCalls,
          billReq: nextBillReq,
          part: nextPart,
          lastPaid: nextLastPaid,
        },
        changed: true,
        meta: { ok: true },
      };
    }

    case 'updateWifi': {
      const res = sanitizeWifiConfig(action.payload.rawName, action.payload.rawPassword);
      if (!res.ok) return { state: s, changed: false, error: res.error, meta: res };
      return {
        state: { ...s, wifi: res.wifi },
        changed: true,
        meta: res,
      };
    }

    case 'savePromoOffer': {
      const res = sanitizePromoOffer(action.payload);
      if (!res.ok) return { state: s, changed: false, error: res.error, meta: res };
      const exists = s.promos.some((p) => p.id === res.promo.id);
      return {
        state: {
          ...s,
          promos: exists
            ? s.promos.map((p) => (p.id === res.promo.id ? res.promo : p))
            : [res.promo, ...s.promos],
        },
        changed: true,
        meta: res,
      };
    }

    case 'togglePromoActive': {
      return {
        state: {
          ...s,
          promos: s.promos.map((p) =>
            p.id === action.payload.id ? { ...p, active: !p.active } : p
          ),
        },
        changed: true,
      };
    }

    case 'deletePromoOffer': {
      return {
        state: {
          ...s,
          promos: s.promos.filter((p) => p.id !== action.payload.id),
        },
        changed: true,
      };
    }

    case 'clearOrdersAndCalls': {
      return {
        state: {
          ...s,
          orders: [],
          calls: [],
          billReq: {},
          part: {},
          lastPaid: {},
        },
        changed: true,
      };
    }

    case 'resetDemo': {
      return {
        state: makeSeed(true, now),
        changed: true,
      };
    }

    default:
      return { state: s, changed: false };
  }
}
