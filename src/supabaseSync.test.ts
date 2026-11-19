import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed } from './data.ts';
import {
  buildSupabaseHeaders,
  fetchSupabaseRev,
  fetchSupabaseState,
  pushSupabaseState,
  readSupabaseConfig,
  type FetchLike,
} from './supabaseSync.ts';

describe('supabaseSync helpers', () => {
  it('reads config from env and handles sb_publishable_ headers without Bearer JWT', () => {
    const cfg = readSupabaseConfig({
      SUPABASE_URL: 'https://humjcgwrnpvtomkvjvtc.supabase.co/',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
    });
    assert.ok(cfg);
    assert.equal(cfg.url, 'https://humjcgwrnpvtomkvjvtc.supabase.co');
    assert.equal(cfg.projectRef, 'humjcgwrnpvtomkvjvtc');

    const pubHeaders = buildSupabaseHeaders('sb_publishable_test_key');
    assert.equal(pubHeaders.apikey, 'sb_publishable_test_key');
    assert.equal(pubHeaders.Authorization, undefined);

    const jwtHeaders = buildSupabaseHeaders('eyJhbGciOiJIUzI1NiJ9.test');
    assert.equal(jwtHeaders.Authorization, 'Bearer eyJhbGciOiJIUzI1NiJ9.test');

    const bareCfg = readSupabaseConfig({
      SUPABASE_URL: 'humjcgwrnpvtomkvjvtc',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
    });
    assert.ok(bareCfg);
    assert.equal(bareCfg.url, 'https://humjcgwrnpvtomkvjvtc.supabase.co');
    assert.equal(bareCfg.projectRef, 'humjcgwrnpvtomkvjvtc');

    assert.equal(readSupabaseConfig({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }), null);
  });

  it('detects missing schema (PGRST205 / 404) cleanly', async () => {
    const cfg = {
      url: 'https://humjcgwrnpvtomkvjvtc.supabase.co',
      key: 'sb_publishable_test',
      projectRef: 'humjcgwrnpvtomkvjvtc',
    };
    const mockFetch: FetchLike = async () => ({
      ok: false,
      status: 404,
      async text() {
        return JSON.stringify({
          code: 'PGRST205',
          message: "Could not find the table 'public.menu_items' in the schema cache",
        });
      },
    });

    const res = await fetchSupabaseState(cfg, mockFetch);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.schemaMissing, true);
    }
  });

  it('pushes full state and reconstructs it round-trip while deleting stale rows', async () => {
    const cfg = {
      url: 'https://humjcgwrnpvtomkvjvtc.supabase.co',
      key: 'sb_publishable_test',
      projectRef: 'humjcgwrnpvtomkvjvtc',
    };

    const tables = new Map<string, Map<string, unknown>>([
      ['menu_items', new Map()],
      ['orders', new Map([['99999', { id: 99999, stale: true }]])],
      ['calls', new Map()],
      ['reviews', new Map()],
      ['stock', new Map()],
      ['meta', new Map()],
    ]);

    const mockFetch: FetchLike = async (input, init) => {
      const url = new URL(String(input));
      const table = url.pathname.split('/').pop() || '';
      const store = tables.get(table);
      if (!store) {
        return { ok: false, status: 404, async text() { return 'PGRST205'; } };
      }

      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'POST') {
        const rows = JSON.parse(String(init?.body || '[]')) as Array<{ id: string; data: unknown }>;
        for (const r of rows) {
          store.set(String(r.id), r.data);
        }
        return { ok: true, status: 201, async text() { return ''; } };
      }

      if (method === 'GET') {
        const select = url.searchParams.get('select') || '';
        const list = [...store.entries()].map(([id, data]) =>
          select === 'id' ? { id } : { id, data }
        );
        return { ok: true, status: 200, async text() { return JSON.stringify(list); } };
      }

      if (method === 'DELETE') {
        const eq = url.searchParams.get('id') || '';
        const targetId = eq.startsWith('eq.') ? eq.slice(3) : eq;
        store.delete(targetId);
        return { ok: true, status: 204, async text() { return ''; } };
      }

      return { ok: false, status: 405, async text() { return 'Method not allowed'; } };
    };

    const seed = makeSeed(true, 1700000000000);
    const pushRes = await pushSupabaseState(cfg, seed, 7, mockFetch);
    assert.equal(pushRes.ok, true);
    assert.equal(tables.get('orders')?.has('99999'), false);
    assert.equal(tables.get('menu_items')?.size, seed.menu.length);

    const fetchRes = await fetchSupabaseState(cfg, mockFetch);
    assert.equal(fetchRes.ok, true);
    if (fetchRes.ok && !fetchRes.empty) {
      assert.equal(fetchRes.rev, 7);
      assert.equal(fetchRes.state.menu.length, seed.menu.length);
      assert.equal(fetchRes.state.orders.length, seed.orders.length);
      assert.equal(fetchRes.state.customers.length, seed.customers.length);
      assert.equal(fetchRes.state.promos.length, seed.promos.length);
      assert.ok(fetchRes.state.menu.every((m) => Boolean(m.img)));
    }
  });

  it('fetchSupabaseRev reads lightweight revision number from meta.state_meta', async () => {
    const cfg = {
      url: 'https://humjcgwrnpvtomkvjvtc.supabase.co',
      key: 'sb_publishable_test',
      projectRef: 'humjcgwrnpvtomkvjvtc',
    };
    const mockFetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify([{ data: { rev: 42, updatedAt: 1700000000000 } }]);
      },
    });
    const revRes = await fetchSupabaseRev(cfg, mockFetch);
    assert.equal(revRes.ok, true);
    if (revRes.ok) {
      assert.equal(revRes.rev, 42);
      assert.equal(revRes.empty, false);
    }
  });
});
