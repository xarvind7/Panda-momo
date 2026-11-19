import type { Call } from './data';

export interface HelpCallNotificationPayload {
  callId: number;
  table: number;
  kind: string;
  waiter: string;
  title: string;
  body: string;
  tag: string;
}

export interface StaffAlertToastItem {
  id: number;
  table: number;
  kind: string;
  waiter: string;
  at: number;
}

export type BrowserNotifPermission = NotificationPermission | 'unsupported';

const BROWSER_NOTIF_PREF_KEY = 'panda-staff-browser-notif';

export function normalizeHelpKind(kind: string): string {
  const trimmed = kind.trim();
  if (!trimmed) return 'Call Waiter';
  if (trimmed.toLowerCase() === 'waiter') return 'Call Waiter';
  return trimmed;
}

export function isExplicitWaiterCall(kind: string): boolean {
  const norm = normalizeHelpKind(kind).toLowerCase();
  return norm === 'call waiter' || norm.includes('waiter');
}

export interface FlashingTableAlert {
  table: number;
  calls: Call[];
  hasWaiterCall: boolean;
  primaryKind: string;
  oldestAt: number;
}

/**
 * Pure helper: groups all unresolved (open) help calls by table number,
 * ordered oldest-first within each table.
 */
export function getActiveCallsByTable(calls: readonly Call[]): Map<number, Call[]> {
  const map = new Map<number, Call[]>();
  const open = calls
    .filter((c) => !c.done)
    .sort((a, b) => (a.at !== b.at ? a.at - b.at : a.id - b.id));

  for (const call of open) {
    const existing = map.get(call.table);
    if (existing) {
      existing.push(call);
    } else {
      map.set(call.table, [call]);
    }
  }
  return map;
}

/**
 * Pure helper: returns true if a specific table has any active (unresolved)
 * Call Waiter or help request that should flash on the Staff floor map.
 */
export function hasActiveCallForTable(
  calls: readonly Call[],
  tableNum: number
): boolean {
  return calls.some((c) => !c.done && c.table === tableNum);
}

/**
 * Pure helper: builds a deterministic list of tables currently flashing on the
 * Staff page, prioritizing active Call Waiter requests and oldest waiting tables.
 */
export function getFlashingCallTables(calls: readonly Call[]): FlashingTableAlert[] {
  const byTable = getActiveCallsByTable(calls);
  const alerts: FlashingTableAlert[] = [];

  for (const [table, tableCalls] of byTable.entries()) {
    const waiterCall = tableCalls.find((c) => isExplicitWaiterCall(c.kind));
    const primary = waiterCall ?? tableCalls[0];
    alerts.push({
      table,
      calls: tableCalls,
      hasWaiterCall: Boolean(waiterCall),
      primaryKind: normalizeHelpKind(primary.kind),
      oldestAt: tableCalls[0].at,
    });
  }

  alerts.sort((a, b) => {
    if (a.hasWaiterCall !== b.hasWaiterCall) return a.hasWaiterCall ? -1 : 1;
    if (a.oldestAt !== b.oldestAt) return a.oldestAt - b.oldestAt;
    return a.table - b.table;
  });

  return alerts;
}

/**
 * Pure diff helper: returns newly arrived unresolved help calls
 * that were not in `seenIds`, sorted oldest-to-newest, plus an updated
 * Set containing all seen call IDs.
 */
export function detectNewHelpCalls(
  calls: readonly Call[],
  seenIds: ReadonlySet<number>
): { newCalls: Call[]; nextSeenIds: Set<number> } {
  const nextSeenIds = new Set<number>(seenIds);
  const newCalls: Call[] = [];

  for (const call of calls) {
    const alreadySeen = seenIds.has(call.id);
    nextSeenIds.add(call.id);
    if (!alreadySeen && !call.done) {
      newCalls.push(call);
    }
  }

  newCalls.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.id - b.id));
  return { newCalls, nextSeenIds };
}

/**
 * Pure formatter for both subtle in-app toasts and native browser notifications.
 */
export function formatHelpCallNotification(
  call: Call,
  waiterName: string
): HelpCallNotificationPayload {
  const kindLabel = normalizeHelpKind(call.kind);
  const cleanWaiter = waiterName.trim() || 'Floor staff';
  const title = `Table ${call.table} · ${kindLabel}`;
  const body =
    kindLabel === 'Call Waiter'
      ? `Guest called for assistance · ${cleanWaiter}`
      : `Guest requested ${kindLabel} · ${cleanWaiter}`;

  return {
    callId: call.id,
    table: call.table,
    kind: kindLabel,
    waiter: cleanWaiter,
    title,
    body,
    tag: `panda-help-call-${call.id}`,
  };
}

/**
 * Removes alert toasts whose underlying call has been resolved or removed.
 */
export function pruneResolvedToasts<T extends { id: number }>(
  toasts: readonly T[],
  calls: readonly Call[]
): T[] {
  if (toasts.length === 0) return [];
  const openIds = new Set<number>();
  for (const call of calls) {
    if (!call.done) openIds.add(call.id);
  }
  return toasts.filter((t) => openIds.has(t.id));
}

/**
 * Appends incoming alert toasts without duplicate IDs and caps the visible stack.
 */
export function appendAlertToasts<T extends { id: number }>(
  existing: readonly T[],
  incoming: readonly T[],
  maxVisible = 3
): T[] {
  if (incoming.length === 0) return [...existing];
  const map = new Map<number, T>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  const merged = Array.from(map.values());
  return merged.length > maxVisible ? merged.slice(merged.length - maxVisible) : merged;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification === 'function';
}

export function getBrowserNotificationPermission(): BrowserNotifPermission {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return window.Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export function getBrowserNotifEnabledPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(BROWSER_NOTIF_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setBrowserNotifEnabledPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BROWSER_NOTIF_PREF_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage restriction
  }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotifPermission> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function dispatchBrowserNotification(
  payload: HelpCallNotificationPayload,
  onClick?: () => void
): Notification | null {
  if (!isBrowserNotificationSupported()) return null;
  if (getBrowserNotificationPermission() !== 'granted') return null;
  try {
    const notif = new window.Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      silent: true,
    });
    if (onClick) {
      notif.onclick = () => {
        try {
          window.focus();
        } catch {
          // Ignore focus restrictions
        }
        onClick();
        notif.close();
      };
    }
    window.setTimeout(() => {
      try {
        notif.close();
      } catch {
        // Ignore
      }
    }, 6500);
    return notif;
  } catch {
    return null;
  }
}
