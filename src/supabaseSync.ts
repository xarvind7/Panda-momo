import type {
  Call,
  CustomerRecord,
  MenuItem,
  Order,
  PromoOffer,
  Review,
  State,
  StockItem,
  TableConfig,
  WifiConfig,
} from './data.ts';
import { normalizeState } from './stateActions.ts';

export const SUPABASE_REALTIME_CHANNEL = 'panda-momo-live';

export const SUPABASE_TABLES = [
  'menu_items',
  'orders',
  'calls',
  'reviews',
  'stock',
  'meta',
] as const;

export type SupabaseTable = (typeof SUPABASE_TABLES)[number];

export const SUPABASE_SCHEMA_SQL = `do $$
declare t text;
begin
  foreach t in array array['menu_items','orders','calls','reviews','stock','meta'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "demo_all" on public.%I', t);
    execute format('create policy "demo_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;`;

export interface SupabaseConfig {
  url: string;
  key: string;
  projectRef: string;
}

export interface SupabaseSyncInfo {
  configured: boolean;
  connected: boolean;
  schemaReady: boolean;
  projectRef: string | null;
  lastSyncAt: number;
  lastError: string | null;
}

interface SupabaseRow<T = unknown> {
  id: string;
  data: T;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.includes('YOUR-PROJECT')) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return `https://${trimmed}`;
}

export function extractProjectRef(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.split('.')[0] || host;
  } catch {
    return url.replace(/^https?:\/\//, '').split('.')[0] || '';
  }
}

export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseConfig | null {
  const rawCandidate =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_PROJECT_ID ||
    '';
  const rawUrl = normalizeSupabaseUrl(rawCandidate);
  const rawKey = (
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!rawUrl || !rawKey) {
    return null;
  }

  return {
    url: rawUrl,
    key: rawKey,
    projectRef: extractProjectRef(rawUrl),
  };
}

export function buildSupabaseHeaders(
  key: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    ...(extra || {}),
  };
  // New sb_publishable_ / sb_secret_ keys are not JWTs; Bearer header is only for JWT keys
  if (!key.startsWith('sb_publishable_') && !key.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function isSchemaMissingError(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes('pgrst205') ||
    lower.includes('could not find the table') ||
    lower.includes('does not exist')
  );
}

async function fetchTableRows(
  config: SupabaseConfig,
  table: SupabaseTable,
  fetchImpl: FetchLike
): Promise<
  | { ok: true; rows: SupabaseRow[] }
  | { ok: false; schemaMissing: boolean; error: string }
> {
  const url = `${config.url}/rest/v1/${table}?select=id,data`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: buildSupabaseHeaders(config.key, {
      Accept: 'application/json',
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      schemaMissing: isSchemaMissingError(res.status, body),
      error: `HTTP ${res.status} on ${table}: ${body.slice(0, 180)}`,
    };
  }
  try {
    const parsed = JSON.parse(body) as SupabaseRow[];
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { ok: false, schemaMissing: false, error: `Invalid JSON on ${table}` };
  }
}

export type FetchSupabaseStateResult =
  | { ok: true; empty: true }
  | { ok: true; empty: false; state: State; rev: number }
  | { ok: false; schemaMissing: boolean; error: string };

export async function fetchSupabaseState(
  config: SupabaseConfig,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
): Promise<FetchSupabaseStateResult> {
  try {
    const results = await Promise.all(
      SUPABASE_TABLES.map(async (table) => ({
        table,
        res: await fetchTableRows(config, table, fetchImpl),
      }))
    );

    const failed = results.find((r) => !r.res.ok);
    if (failed && !failed.res.ok) {
      return {
        ok: false,
        schemaMissing: failed.res.schemaMissing,
        error: failed.res.error,
      };
    }

    const byTable = Object.fromEntries(
      results.map((r) => [r.table, r.res.ok ? r.res.rows : []])
    ) as Record<SupabaseTable, SupabaseRow[]>;

    const totalRows = SUPABASE_TABLES.reduce(
      (sum, t) => sum + byTable[t].length,
      0
    );
    if (totalRows === 0) {
      return { ok: true, empty: true };
    }

    const metaMap = new Map<string, unknown>(
      byTable.meta.map((row) => [row.id, row.data])
    );

    const tablesMeta = metaMap.get('tables') as { items?: TableConfig[] } | TableConfig[] | undefined;
    const tables = Array.isArray(tablesMeta)
      ? tablesMeta
      : Array.isArray(tablesMeta?.items)
        ? tablesMeta.items
        : undefined;

    const promosMeta = metaMap.get('promos') as { items?: PromoOffer[] } | PromoOffer[] | undefined;
    const promos = Array.isArray(promosMeta)
      ? promosMeta
      : Array.isArray(promosMeta?.items)
        ? promosMeta.items
        : undefined;

    const customersMeta = metaMap.get('customers') as
      | { items?: CustomerRecord[] }
      | CustomerRecord[]
      | undefined;
    const customers = Array.isArray(customersMeta)
      ? customersMeta
      : Array.isArray(customersMeta?.items)
        ? customersMeta.items
        : undefined;

    const wifiMeta = metaMap.get('wifi') as WifiConfig | undefined;
    const stateMeta = metaMap.get('state_meta') as { rev?: number } | undefined;
    const hasStateMeta = metaMap.has('state_meta');

    const menu = byTable.menu_items
      .map((r) => r.data as MenuItem)
      .filter((m) => m && typeof m.id === 'string')
      .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));

    const orders = byTable.orders.map((r) => r.data as Order);
    const calls = byTable.calls.map((r) => r.data as Call);
    const reviews = byTable.reviews.map((r) => r.data as Review);
    const stock = byTable.stock.map((r) => r.data as StockItem);

    const rawPartial: Partial<State> = {
      ...(menu.length > 0 ? { menu } : {}),
      ...(hasStateMeta || orders.length > 0 ? { orders } : {}),
      ...(hasStateMeta || calls.length > 0 ? { calls } : {}),
      ...(hasStateMeta || reviews.length > 0 ? { reviews } : {}),
      ...(hasStateMeta || stock.length > 0 ? { stock } : {}),
      ...(tables ? { tables } : {}),
      ...(wifiMeta ? { wifi: wifiMeta } : {}),
      ...(promos ? { promos } : {}),
      ...(customers ? { customers } : {}),
    };

    const normalized = normalizeState(rawPartial, true);
    const rev =
      typeof stateMeta?.rev === 'number' && stateMeta.rev >= 1
        ? stateMeta.rev
        : 1;

    return { ok: true, empty: false, state: normalized, rev };
  } catch (err) {
    return {
      ok: false,
      schemaMissing: true,
      error: err instanceof Error ? err.message : 'Supabase fetch failed',
    };
  }
}

export async function fetchSupabaseRev(
  config: SupabaseConfig,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
): Promise<
  | { ok: true; rev: number; updatedAt: number; empty: boolean }
  | { ok: false; schemaMissing: boolean; error: string }
> {
  try {
    const url = `${config.url}/rest/v1/meta?id=eq.state_meta&select=data`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: buildSupabaseHeaders(config.key, { Accept: 'application/json' }),
    });
    const body = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        schemaMissing: isSchemaMissingError(res.status, body),
        error: `HTTP ${res.status} reading state_meta: ${body.slice(0, 140)}`,
      };
    }
    const rows = JSON.parse(body) as Array<{ data?: { rev?: number; updatedAt?: number } }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: true, rev: 0, updatedAt: 0, empty: true };
    }
    const meta = rows[0]?.data;
    return {
      ok: true,
      rev: typeof meta?.rev === 'number' ? meta.rev : 0,
      updatedAt: typeof meta?.updatedAt === 'number' ? meta.updatedAt : 0,
      empty: false,
    };
  } catch (err) {
    return {
      ok: false,
      schemaMissing: true,
      error: err instanceof Error ? err.message : 'Supabase rev check failed',
    };
  }
}

async function syncSingleTable(
  config: SupabaseConfig,
  table: SupabaseTable,
  rows: SupabaseRow[],
  fetchImpl: FetchLike
): Promise<{ ok: true } | { ok: false; schemaMissing: boolean; error: string }> {
  // 1. Upsert target rows when non-empty
  if (rows.length > 0) {
    const upsertRes = await fetchImpl(`${config.url}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: buildSupabaseHeaders(config.key, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rows),
    });
    if (!upsertRes.ok) {
      const body = await upsertRes.text();
      return {
        ok: false,
        schemaMissing: isSchemaMissingError(upsertRes.status, body),
        error: `HTTP ${upsertRes.status} upserting ${table}: ${body.slice(0, 180)}`,
      };
    }
  }

  // 2. Remove stale IDs no longer present in state
  const existingRes = await fetchImpl(`${config.url}/rest/v1/${table}?select=id`, {
    method: 'GET',
    headers: buildSupabaseHeaders(config.key, { Accept: 'application/json' }),
  });
  if (!existingRes.ok) {
    const body = await existingRes.text();
    return {
      ok: false,
      schemaMissing: isSchemaMissingError(existingRes.status, body),
      error: `HTTP ${existingRes.status} listing ${table}: ${body.slice(0, 180)}`,
    };
  }

  const existingBody = await existingRes.text();
  const existingIds = (JSON.parse(existingBody) as Array<{ id: string }>).map(
    (r) => String(r.id)
  );
  const keepIds = new Set(rows.map((r) => String(r.id)));
  const staleIds = existingIds.filter((id) => !keepIds.has(id));

  for (const staleId of staleIds) {
    const delRes = await fetchImpl(
      `${config.url}/rest/v1/${table}?id=eq.${encodeURIComponent(staleId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(config.key, {
          Prefer: 'return=minimal',
        }),
      }
    );
    if (!delRes.ok) {
      const body = await delRes.text();
      return {
        ok: false,
        schemaMissing: isSchemaMissingError(delRes.status, body),
        error: `HTTP ${delRes.status} deleting stale row in ${table}: ${body.slice(0, 180)}`,
      };
    }
  }

  return { ok: true };
}

export async function pushSupabaseState(
  config: SupabaseConfig,
  state: State,
  rev: number,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
): Promise<{ ok: true } | { ok: false; schemaMissing: boolean; error: string }> {
  try {
    const tablePayloads: Array<{ table: SupabaseTable; rows: SupabaseRow[] }> = [
      {
        table: 'menu_items',
        rows: state.menu.map((item) => ({ id: String(item.id), data: item })),
      },
      {
        table: 'orders',
        rows: state.orders.map((order) => ({ id: String(order.id), data: order })),
      },
      {
        table: 'calls',
        rows: state.calls.map((call) => ({ id: String(call.id), data: call })),
      },
      {
        table: 'reviews',
        rows: state.reviews.map((review, idx) => ({
          id: `${review.table}_${review.at}_${idx}`,
          data: review,
        })),
      },
      {
        table: 'stock',
        rows: state.stock.map((item) => ({ id: String(item.name), data: item })),
      },
      {
        table: 'meta',
        rows: [
          { id: 'tables', data: { items: state.tables } },
          { id: 'wifi', data: state.wifi },
          { id: 'promos', data: { items: state.promos } },
          { id: 'customers', data: { items: state.customers } },
          { id: 'state_meta', data: { rev, updatedAt: Date.now() } },
        ],
      },
    ];

    const results = await Promise.all(
      tablePayloads.map((p) => syncSingleTable(config, p.table, p.rows, fetchImpl))
    );
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      return failed;
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      schemaMissing: false,
      error: err instanceof Error ? err.message : 'Supabase push failed',
    };
  }
}
