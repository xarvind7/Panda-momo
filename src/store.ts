import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  byId,
  DEFAULT_PROMOS,
  DEFAULT_TABLES,
  DEFAULT_WIFI,
  makeSeed,
  nid,
  setMenu,
  type CustomerRecord,
  type Line,
  type MenuItem,
  type Order,
  type PromoOffer,
  type PromoPlatform,
  type State,
  type Status,
  type StockItem,
  type WifiConfig,
} from './data';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  applyStoreAction,
  normalizeState,
  type StoreAction,
} from './stateActions';
import {
  extractProjectRef,
  fetchSupabaseState,
  normalizeSupabaseUrl,
  pushSupabaseState,
  SUPABASE_REALTIME_CHANNEL,
  type SupabaseConfig,
  type SupabaseSyncInfo,
} from './supabaseSync';
import { verifyPasswordAgainstDigest } from './adminCrypto';

const STORAGE_KEY = 'chai-pana-v1';
const CHIME_KEY = 'chime';
const ADMIN_SESSION_KEY = 'adm';
const ADMIN_TOKEN_KEY = 'adm_token';

const env =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env) ||
  {};
const SUPA_URL = normalizeSupabaseUrl(env.VITE_SUPABASE_URL || '');
const SUPA_KEY = (env.VITE_SUPABASE_ANON_KEY || '').trim();
const CLIENT_SUPA_CONFIG: SupabaseConfig | null =
  SUPA_URL && SUPA_KEY
    ? {
        url: SUPA_URL,
        key: SUPA_KEY,
        projectRef: extractProjectRef(SUPA_URL),
      }
    : null;

export const IS_REMOTE = Boolean(CLIENT_SUPA_CONFIG);

export interface SyncMeta {
  connected: boolean;
  rev: number;
  lastSyncAt: number;
  mode: 'realtime' | 'local';
  supabase?: SupabaseSyncInfo;
}

function loadInitialState(): State {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = normalizeState(parsed, true);
        setMenu(merged.menu);
        return merged;
      }
    } catch {
      // Fall back to seed
    }
  }
  const seeded = makeSeed(true);
  setMenu(seeded.menu);
  return seeded;
}

let state: State = loadInitialState();
let syncMeta: SyncMeta = {
  connected: false,
  rev: 0,
  lastSyncAt: 0,
  mode: 'local',
  supabase: IS_REMOTE
    ? {
        configured: true,
        connected: false,
        schemaReady: false,
        projectRef: null,
        lastSyncAt: 0,
        lastError: null,
      }
    : undefined,
};

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();

let pendingMutations = 0;
let dispatchChain: Promise<void> = Promise.resolve();
let eventSource: EventSource | null = null;
let supabaseClient: SupabaseClient | null = null;
let supabaseChannel: RealtimeChannel | null = null;
let supabaseChannelReady = false;
let supabasePullTimer: number | null = null;
const browserInstanceId =
  typeof Math !== 'undefined' ? `web_${Math.random().toString(36).slice(2, 10)}` : 'web';

function emit(): void {
  for (const l of listeners) l();
}

function emitSync(): void {
  for (const l of syncListeners) l();
}

function saveLocal(s: State): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Ignore storage quota errors
  }
}

function applyAuthoritativeServerState(
  nextRaw: unknown,
  rev: number,
  serverTime?: number,
  supabase?: SupabaseSyncInfo
): void {
  const next = normalizeState(nextRaw, true);
  const changed = JSON.stringify(next) !== JSON.stringify(state);
  syncMeta = {
    connected: true,
    rev: Math.max(syncMeta.rev, rev),
    lastSyncAt: serverTime || Date.now(),
    mode: 'realtime',
    supabase: supabase ?? syncMeta.supabase,
  };
  emitSync();

  if (changed) {
    state = next;
    setMenu(state.menu);
    saveLocal(state);
    emit();
  }
}

async function pullDirectFromSupabase(): Promise<void> {
  if (!CLIENT_SUPA_CONFIG || pendingMutations > 0) return;
  const res = await fetchSupabaseState(CLIENT_SUPA_CONFIG);
  if (!res.ok) return;
  const info: SupabaseSyncInfo = {
    configured: true,
    connected: true,
    schemaReady: true,
    projectRef: CLIENT_SUPA_CONFIG.projectRef,
    lastSyncAt: Date.now(),
    lastError: null,
  };
  if (res.empty) {
    syncMeta = { ...syncMeta, supabase: info };
    emitSync();
    return;
  }
  if (res.rev >= syncMeta.rev && pendingMutations === 0) {
    applyAuthoritativeServerState(res.state, res.rev, Date.now(), info);
  }
}

function scheduleSupabasePull(): void {
  if (typeof window === 'undefined' || !CLIENT_SUPA_CONFIG) return;
  if (supabasePullTimer !== null) {
    window.clearTimeout(supabasePullTimer);
  }
  supabasePullTimer = window.setTimeout(() => {
    supabasePullTimer = null;
    void pullDirectFromSupabase();
  }, 120);
}

function connectSupabaseRealtime(): void {
  if (typeof window === 'undefined' || !CLIENT_SUPA_CONFIG) return;
  try {
    if (!supabaseClient) {
      supabaseClient = createClient(CLIENT_SUPA_CONFIG.url, CLIENT_SUPA_CONFIG.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    if (supabaseChannel) {
      void supabaseClient.removeChannel(supabaseChannel);
      supabaseChannel = null;
      supabaseChannelReady = false;
    }

    const ch = supabaseClient.channel(SUPABASE_REALTIME_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'sync' }, (msg) => {
      const payload = msg?.payload as { rev?: number; source?: string } | undefined;
      if (payload?.source === browserInstanceId) return;
      if (!payload?.rev || payload.rev > syncMeta.rev) {
        scheduleSupabasePull();
      }
    })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        scheduleSupabasePull();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        scheduleSupabasePull();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        scheduleSupabasePull();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        scheduleSupabasePull();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta' }, () => {
        scheduleSupabasePull();
      })
      .subscribe((status) => {
        supabaseChannelReady = status === 'SUBSCRIBED';
      });

    supabaseChannel = ch;
  } catch {
    // Fallback to SSE stream
  }
}

function broadcastBrowserSupabaseSync(rev: number): void {
  if (!supabaseChannel || !supabaseChannelReady) return;
  void supabaseChannel.send({
    type: 'broadcast',
    event: 'sync',
    payload: { rev, source: browserInstanceId, updatedAt: Date.now() },
  });
}

async function fetchInitialServerState(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) {
      await pullDirectFromSupabase();
      return;
    }
    const data = (await res.json()) as {
      ok?: boolean;
      rev?: number;
      state?: unknown;
      supabase?: SupabaseSyncInfo;
      serverTime?: number;
    };
    if (data?.ok && data.state && pendingMutations === 0) {
      applyAuthoritativeServerState(
        data.state,
        data.rev ?? 1,
        data.serverTime,
        data.supabase
      );
      return;
    }
  } catch {
    // Fallback directly to Supabase if Express server is unavailable
  }
  await pullDirectFromSupabase();
}

export async function triggerSupabaseSync(): Promise<{
  ok: boolean;
  supabase?: SupabaseSyncInfo;
  error?: string;
}> {
  if (typeof window === 'undefined') return { ok: false };
  try {
    const res = await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = (await res.json()) as {
      ok?: boolean;
      rev?: number;
      state?: unknown;
      supabase?: SupabaseSyncInfo;
      error?: string;
      serverTime?: number;
    };
    if (data?.state && typeof data.rev === 'number') {
      applyAuthoritativeServerState(
        data.state,
        data.rev,
        data.serverTime,
        data.supabase
      );
    } else if (data?.supabase) {
      syncMeta = { ...syncMeta, supabase: data.supabase };
      emitSync();
    }
    return { ok: Boolean(data?.ok), supabase: data?.supabase, error: data?.error };
  } catch {
    return { ok: false, error: 'Server se connect nahi ho paya.' };
  }
}

function connectRealtimeStream(): void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  if (eventSource) {
    eventSource.close();
  }

  const es = new EventSource('/api/stream');
  eventSource = es;

  es.addEventListener('sync', (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent).data) as {
        rev?: number;
        state?: unknown;
        supabase?: SupabaseSyncInfo;
        serverTime?: number;
      };
      if (
        payload?.state &&
        typeof payload.rev === 'number' &&
        (pendingMutations === 0 || payload.rev >= syncMeta.rev)
      ) {
        applyAuthoritativeServerState(
          payload.state,
          payload.rev,
          payload.serverTime,
          payload.supabase
        );
      }
    } catch {
      // Ignore malformed SSE event
    }
  });

  es.onopen = () => {
    syncMeta = {
      ...syncMeta,
      connected: true,
      mode: 'realtime',
    };
    emitSync();
  };

  es.onerror = () => {
    syncMeta = {
      ...syncMeta,
      connected: false,
    };
    emitSync();
  };
}

function dispatchAction(action: StoreAction): ReturnType<typeof applyStoreAction> {
  // Optimistic local update for zero-latency UI
  const result = applyStoreAction(state, action, Date.now());
  if (result.changed) {
    state = result.state;
    setMenu(state.menu);
    saveLocal(state);
    emit();
  }

  // Send authoritative mutation sequentially to server
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    pendingMutations += 1;
    dispatchChain = dispatchChain
      .then(async () => {
        let serverHandled = false;
        try {
          const res = await fetch('/api/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
          if (res.ok) {
            serverHandled = true;
            const payload = (await res.json()) as {
              ok?: boolean;
              rev?: number;
              state?: unknown;
              supabase?: SupabaseSyncInfo;
              serverTime?: number;
            };
            if (payload?.state && typeof payload.rev === 'number') {
              if (pendingMutations <= 1) {
                applyAuthoritativeServerState(
                  payload.state,
                  payload.rev,
                  payload.serverTime,
                  payload.supabase
                );
              }
            }
          }
        } catch {
          // Will attempt direct Supabase fallback below
        }

        if (!serverHandled && CLIENT_SUPA_CONFIG && result.changed) {
          const nextRev = Math.max(syncMeta.rev + 1, 1);
          const pushed = await pushSupabaseState(CLIENT_SUPA_CONFIG, state, nextRev);
          if (pushed.ok) {
            syncMeta = {
              connected: true,
              rev: nextRev,
              lastSyncAt: Date.now(),
              mode: 'realtime',
              supabase: {
                configured: true,
                connected: true,
                schemaReady: true,
                projectRef: CLIENT_SUPA_CONFIG.projectRef,
                lastSyncAt: Date.now(),
                lastError: null,
              },
            };
            emitSync();
            broadcastBrowserSupabaseSync(nextRev);
          }
        }

        pendingMutations = Math.max(0, pendingMutations - 1);
      })
      .catch(() => {
        pendingMutations = Math.max(0, pendingMutations - 1);
      });
  }

  return result;
}

// Cross-tab localStorage sync + Real-Time Server Stream + Supabase Realtime
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as State;
      if (Array.isArray(parsed.menu)) {
        state = normalizeState(parsed, true);
        setMenu(state.menu);
        emit();
      }
    } catch {
      // Ignore malformed storage payload
    }
  });

  void fetchInitialServerState();
  connectRealtimeStream();
  connectSupabaseRealtime();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void fetchInitialServerState();
      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        connectRealtimeStream();
      }
      if (CLIENT_SUPA_CONFIG && !supabaseChannelReady) {
        connectSupabaseRealtime();
      }
    }
  });

  window.addEventListener('online', () => {
    void fetchInitialServerState();
    connectRealtimeStream();
    connectSupabaseRealtime();
  });
}

export function getState(): State {
  return state;
}

export function getSyncMeta(): SyncMeta {
  return syncMeta;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeSyncMeta(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useSyncMeta(): SyncMeta {
  return useSyncExternalStore(subscribeSyncMeta, getSyncMeta, getSyncMeta);
}

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

// --- Encrypted Admin Authentication ---

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasStoredAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_SESSION_KEY) === '1' ||
      Boolean(window.sessionStorage.getItem(ADMIN_TOKEN_KEY))
    );
  } catch {
    return false;
  }
}

export function logoutAdmin(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function verifyAdminLogin(
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = password;
  if (!trimmed) {
    return { ok: false, error: 'Password daalo.' };
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      token?: string;
      error?: string;
    };
    if (res.ok && data.ok && data.token) {
      try {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      } catch {
        // Ignore storage errors
      }
      return { ok: true };
    }
    if (res.status === 401 || res.status === 400) {
      return { ok: false, error: data.error || 'Password galat hai. Dobara try karo.' };
    }
  } catch {
    // Network offline fallback: verify locally against salted PBKDF2-SHA256 digest
  }

  const localOk = await verifyPasswordAgainstDigest(trimmed);
  if (localOk) {
    try {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    } catch {
      // Ignore
    }
    return { ok: true };
  }
  return { ok: false, error: 'Password galat hai. Dobara try karo.' };
}

export async function checkAdminSession(): Promise<boolean> {
  const token = getStoredAdminToken();
  if (!token) return hasStoredAdminSession();
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return hasStoredAdminSession();
    const data = (await res.json()) as { ok?: boolean };
    if (!data.ok) {
      logoutAdmin();
      return false;
    }
    return true;
  } catch {
    return hasStoredAdminSession();
  }
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getStoredAdminToken();
  if (!token) {
    return { ok: false, error: 'Server admin session active nahi hai. Dobara login karo.' };
  }
  try {
    const res = await fetch('/api/admin/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      token?: string;
      error?: string;
    };
    if (res.ok && data.ok) {
      if (data.token) {
        try {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        } catch {
          // Ignore
        }
      }
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Password update nahi ho paya.' };
  } catch {
    return { ok: false, error: 'Server connect nahi ho paya.' };
  }
}

// --- Chime (Web Audio two-note sine: 660Hz then 880Hz, 0.16s apart, gain 0.25) ---
let audioCtx: AudioContext | null = null;

export function isChimeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(CHIME_KEY) !== 'off';
}

export function setChimeEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHIME_KEY, on ? 'on' : 'off');
  if (on) playChime(true);
}

export function playChime(force = false): void {
  if (typeof window === 'undefined') return;
  if (!force && !isChimeEnabled()) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const notes = [
      { freq: 660, start: now },
      { freq: 880, start: now + 0.16 },
    ];
    for (const n of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, n.start);
      gain.gain.setValueAtTime(0.0001, n.start);
      gain.gain.exponentialRampToValueAtTime(0.25, n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, n.start + 0.24);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(n.start);
      osc.stop(n.start + 0.26);
    }
  } catch {
    // Ignore autoplay or Web Audio restrictions
  }
}

export function useOrderChime(): void {
  const s = useStore();
  const newCount = s.orders.filter((o) => !o.paid && o.status === 'new').length;
  const prevCount = useRef<number | null>(null);

  useEffect(() => {
    if (prevCount.current !== null && newCount > prevCount.current) {
      playChime();
    }
    prevCount.current = newCount;
  }, [newCount]);
}

// --- Actions (all flow through authoritative server + real-time SSE broadcast) ---

export function registerGuest(
  rawName: string,
  rawPhone: string,
  table: number | null,
  incrementVisit = true
): { ok: true; name: string; phone: string } | { ok: false; error: string } {
  const res = dispatchAction({
    type: 'registerGuest',
    payload: { rawName, rawPhone, table, incrementVisit },
  });
  return res.meta as { ok: true; name: string; phone: string } | { ok: false; error: string };
}

export function addCustomerManual(input: {
  name: string;
  phone: string;
  tags?: string[];
  notes?: string;
  birthday?: string;
  loyaltyPoints?: number;
}): { ok: true; customer: CustomerRecord } | { ok: false; error: string } {
  const res = dispatchAction({
    type: 'addCustomerManual',
    payload: input,
  });
  return res.meta as { ok: true; customer: CustomerRecord } | { ok: false; error: string };
}

export function updateCustomerProfile(
  phone: string,
  patch: {
    name?: string;
    tags?: string[];
    notes?: string;
    birthday?: string;
  }
): void {
  dispatchAction({
    type: 'updateCustomerProfile',
    payload: { phone, patch },
  });
}

export function adjustCustomerPoints(
  phone: string,
  delta: number,
  baseFallback = 0
): void {
  dispatchAction({
    type: 'adjustCustomerPoints',
    payload: { phone, delta, baseFallback },
  });
}

export function recordCustomerVisit(phone: string): void {
  dispatchAction({
    type: 'recordCustomerVisit',
    payload: { phone },
  });
}

export function deleteCustomerRecord(phone: string): void {
  dispatchAction({
    type: 'deleteCustomerRecord',
    payload: { phone },
  });
}

export function placeOrder(
  table: number | null,
  lines: Line[],
  by: 'guest' | 'waiter' | 'whatsapp' = 'guest',
  channel: 'dine' | 'whatsapp' = 'dine',
  customer?: string,
  customerPhone?: string
): Order | null {
  const res = dispatchAction({
    type: 'placeOrder',
    payload: {
      orderId: nid(),
      table,
      lines,
      by,
      channel,
      customer,
      customerPhone,
    },
  });
  return (res.meta as Order | undefined) ?? null;
}

export function simulateWhatsAppOrder(): Order | null {
  return placeOrder(
    null,
    [
      { itemId: 'masala', qty: 4, size: 'full' },
      { itemId: 'samosa', qty: 2, size: 'full' },
    ],
    'whatsapp',
    'whatsapp',
    'Rahul (Delivery, Naraina)'
  );
}

export function setOrderStatus(orderId: number, status: Status, actor?: string): void {
  dispatchAction({
    type: 'setOrderStatus',
    payload: { orderId, status, actor },
  });
}

export function callWaiter(table: number, kind: string): void {
  dispatchAction({
    type: 'callWaiter',
    payload: { callId: nid(), table, kind },
  });
}

export function resolveCall(callId: number): void {
  dispatchAction({
    type: 'resolveCall',
    payload: { callId },
  });
}

export function payShare(
  table: number,
  parts: number,
  method: string,
  tipTotal: number,
  promoId?: string | null
): boolean {
  const res = dispatchAction({
    type: 'payShare',
    payload: { table, parts, method, tipTotal, promoId },
  });
  return Boolean(res.meta);
}

export function collectFull(table: number, method: string): void {
  payShare(table, 1, method, 0);
}

export function addReview(table: number, stars: number, text: string): void {
  dispatchAction({
    type: 'addReview',
    payload: { table, stars, text },
  });
}

export function saveMenuItem(
  item: Omit<MenuItem, 'id' | 'pos'> & { id?: string; pos?: number }
): MenuItem {
  const id = item.id || 'i' + Date.now().toString(36);
  const res = dispatchAction({
    type: 'saveMenuItem',
    payload: { ...item, id },
  });
  return res.meta as MenuItem;
}

export function toggleMenuAvailable(id: string): void {
  dispatchAction({
    type: 'toggleMenuAvailable',
    payload: { id },
  });
}

export function deleteMenuItem(id: string): void {
  dispatchAction({
    type: 'deleteMenuItem',
    payload: { id },
  });
}

export function updateStockQty(name: string, qty: number): void {
  dispatchAction({
    type: 'updateStockQty',
    payload: { name, qty },
  });
}

export function restockItem(name: string): void {
  dispatchAction({
    type: 'restockItem',
    payload: { name },
  });
}

export function addStockItem(item: StockItem): { ok: boolean; error?: string } {
  const res = dispatchAction({
    type: 'addStockItem',
    payload: { item },
  });
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}

export function deleteStockItem(name: string): void {
  dispatchAction({
    type: 'deleteStockItem',
    payload: { name },
  });
}

export function addTable(num: number, waiter: string): { ok: boolean; error?: string } {
  const res = dispatchAction({
    type: 'addTable',
    payload: { num, waiter },
  });
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}

export function deleteTable(num: number): { ok: boolean; error?: string } {
  const res = dispatchAction({
    type: 'deleteTable',
    payload: { num },
  });
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}

export function updateWifi(
  rawName: string,
  rawPassword: string
): { ok: true; wifi: WifiConfig } | { ok: false; error: string } {
  const res = dispatchAction({
    type: 'updateWifi',
    payload: { rawName, rawPassword },
  });
  return res.meta as { ok: true; wifi: WifiConfig } | { ok: false; error: string };
}

export function savePromoOffer(input: {
  id?: string;
  title: string;
  platform: PromoPlatform;
  handleOrUrl: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  minBill: number;
  description: string;
  active: boolean;
}): { ok: true; promo: PromoOffer } | { ok: false; error: string } {
  const id = input.id || 'pr_' + Date.now().toString(36);
  const res = dispatchAction({
    type: 'savePromoOffer',
    payload: { ...input, id },
  });
  return res.meta as { ok: true; promo: PromoOffer } | { ok: false; error: string };
}

export function togglePromoActive(id: string): void {
  dispatchAction({
    type: 'togglePromoActive',
    payload: { id },
  });
}

export function deletePromoOffer(id: string): void {
  dispatchAction({
    type: 'deletePromoOffer',
    payload: { id },
  });
}

export function clearOrdersAndCalls(): void {
  dispatchAction({ type: 'clearOrdersAndCalls' });
}

export function resetDemo(): void {
  dispatchAction({ type: 'resetDemo' });
}

export { byId };
