import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import {
  createPasswordDigest,
  DEFAULT_ADMIN_DIGEST,
  verifyPasswordAgainstDigest,
  type AdminPasswordDigest,
} from './src/adminCrypto.ts';
import { makeSeed, setMenu, type State } from './src/data.ts';
import { applyStoreAction, normalizeState, type StoreAction } from './src/stateActions.ts';
import {
  fetchSupabaseRev,
  fetchSupabaseState,
  pushSupabaseState,
  readSupabaseConfig,
  SUPABASE_REALTIME_CHANNEL,
  type SupabaseSyncInfo,
} from './src/supabaseSync.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'panda-momo-db.json');
const AUTH_FILE = path.join(DATA_DIR, 'panda-momo-auth.json');

interface PersistedAuth {
  digest: AdminPasswordDigest;
  tokenSecret: string;
  updatedAt: number;
}

interface PersistedDb {
  rev: number;
  updatedAt: number;
  state: State;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function atomicWriteJson(filePath: string, value: unknown) {
  ensureDataDir();
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function loadOrCreateAuth(): PersistedAuth {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Partial<PersistedAuth>;
      if (
        parsed.digest &&
        parsed.digest.saltHex &&
        parsed.digest.hashHex &&
        typeof parsed.tokenSecret === 'string' &&
        parsed.tokenSecret.length >= 32
      ) {
        return {
          digest: parsed.digest,
          tokenSecret: parsed.tokenSecret,
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch {
    // Re-initialize encrypted auth store if corrupted
  }

  const initial: PersistedAuth = {
    digest: DEFAULT_ADMIN_DIGEST,
    tokenSecret: crypto.randomBytes(32).toString('hex'),
    updatedAt: Date.now(),
  };
  atomicWriteJson(AUTH_FILE, initial);
  return initial;
}

function loadOrCreateDb(): PersistedDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<PersistedDb>;
      if (parsed.state) {
        const state = normalizeState(parsed.state, true);
        setMenu(state.menu);
        return {
          rev: typeof parsed.rev === 'number' && parsed.rev >= 1 ? parsed.rev : 1,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
          state,
        };
      }
    }
  } catch {
    // Re-seed if DB file invalid
  }

  const seeded = makeSeed(true, Date.now());
  setMenu(seeded.menu);
  const initial: PersistedDb = {
    rev: 1,
    updatedAt: Date.now(),
    state: seeded,
  };
  atomicWriteJson(DB_FILE, initial);
  return initial;
}

let authStore = loadOrCreateAuth();
let db = loadOrCreateDb();

const supabaseConfig = readSupabaseConfig(process.env);
const serverInstanceId = crypto.randomBytes(6).toString('hex');
let supabaseStatus: SupabaseSyncInfo = {
  configured: Boolean(supabaseConfig),
  connected: false,
  schemaReady: false,
  projectRef: supabaseConfig?.projectRef ?? null,
  lastSyncAt: 0,
  lastError: null,
};
let supabaseChain: Promise<void> = Promise.resolve();
let supabaseRealtimeChannel: RealtimeChannel | null = null;
let supabaseRealtimeReady = false;
let pollInFlight = false;

const sseClients = new Set<Response>();

function broadcastSync() {
  const payload = JSON.stringify({
    rev: db.rev,
    state: db.state,
    supabase: supabaseStatus,
    serverTime: Date.now(),
  });
  for (const res of sseClients) {
    try {
      res.write(`id: ${db.rev}\nevent: sync\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

function broadcastSupabaseRealtime(rev: number) {
  if (!supabaseRealtimeChannel || !supabaseRealtimeReady) return;
  void supabaseRealtimeChannel.send({
    type: 'broadcast',
    event: 'sync',
    payload: { rev, source: serverInstanceId, updatedAt: Date.now() },
  });
}

function enqueueSupabasePush(snapshotState: State, snapshotRev: number): Promise<void> {
  if (!supabaseConfig) return Promise.resolve();
  supabaseChain = supabaseChain
    .then(async () => {
      const prevConnected = supabaseStatus.connected;
      const prevSchemaReady = supabaseStatus.schemaReady;
      const res = await pushSupabaseState(supabaseConfig, snapshotState, snapshotRev);
      if (res.ok) {
        supabaseStatus = {
          configured: true,
          connected: true,
          schemaReady: true,
          projectRef: supabaseConfig.projectRef,
          lastSyncAt: Date.now(),
          lastError: null,
        };
        broadcastSupabaseRealtime(snapshotRev);
      } else {
        supabaseStatus = {
          configured: true,
          connected: false,
          schemaReady: !res.schemaMissing,
          projectRef: supabaseConfig.projectRef,
          lastSyncAt: supabaseStatus.lastSyncAt,
          lastError: res.error,
        };
      }
      if (
        prevConnected !== supabaseStatus.connected ||
        prevSchemaReady !== supabaseStatus.schemaReady
      ) {
        broadcastSync();
      }
    })
    .catch((err) => {
      supabaseStatus = {
        ...supabaseStatus,
        connected: false,
        lastError: err instanceof Error ? err.message : 'Supabase sync failed',
      };
    });
  return supabaseChain;
}

async function bootstrapOrSyncSupabase(isInitial = false): Promise<SupabaseSyncInfo> {
  if (!supabaseConfig) return supabaseStatus;
  const fetchRes = await fetchSupabaseState(supabaseConfig);
  if (!fetchRes.ok) {
    const prevConnected = supabaseStatus.connected;
    const prevSchema = supabaseStatus.schemaReady;
    supabaseStatus = {
      configured: true,
      connected: false,
      schemaReady: !fetchRes.schemaMissing,
      projectRef: supabaseConfig.projectRef,
      lastSyncAt: supabaseStatus.lastSyncAt,
      lastError: fetchRes.error,
    };
    if (prevConnected !== supabaseStatus.connected || prevSchema !== supabaseStatus.schemaReady) {
      broadcastSync();
    }
    return supabaseStatus;
  }

  if (fetchRes.empty) {
    await enqueueSupabasePush(db.state, db.rev);
    return supabaseStatus;
  }

  const shouldAdoptRemote = isInitial ? fetchRes.rev >= db.rev : fetchRes.rev > db.rev;
  let stateChanged = false;
  if (shouldAdoptRemote) {
    db = {
      rev: Math.max(db.rev, fetchRes.rev),
      updatedAt: Date.now(),
      state: fetchRes.state,
    };
    setMenu(db.state.menu);
    atomicWriteJson(DB_FILE, db);
    stateChanged = true;
  } else if (db.rev > fetchRes.rev) {
    await enqueueSupabasePush(db.state, db.rev);
    return supabaseStatus;
  }

  const becameConnected = !supabaseStatus.connected || !supabaseStatus.schemaReady;
  supabaseStatus = {
    configured: true,
    connected: true,
    schemaReady: true,
    projectRef: supabaseConfig.projectRef,
    lastSyncAt: Date.now(),
    lastError: null,
  };
  if (stateChanged || becameConnected) {
    broadcastSync();
  }
  return supabaseStatus;
}

async function pollSupabaseRemoteChanges(forcePull = false): Promise<void> {
  if (!supabaseConfig || pollInFlight) return;
  pollInFlight = true;
  try {
    if (!supabaseStatus.connected || !supabaseStatus.schemaReady) {
      await bootstrapOrSyncSupabase(false);
      return;
    }
    if (forcePull) {
      await bootstrapOrSyncSupabase(false);
      return;
    }
    const revCheck = await fetchSupabaseRev(supabaseConfig);
    if (!revCheck.ok) {
      if (revCheck.schemaMissing) {
        supabaseStatus = {
          ...supabaseStatus,
          connected: false,
          schemaReady: false,
          lastError: revCheck.error,
        };
        broadcastSync();
      }
      return;
    }
    if (revCheck.empty || revCheck.rev > db.rev) {
      await bootstrapOrSyncSupabase(false);
    }
  } finally {
    pollInFlight = false;
  }
}

function startSupabaseRealtimeSubscription() {
  if (!supabaseConfig) return;
  try {
    const client = createClient(supabaseConfig.url, supabaseConfig.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = client.channel(SUPABASE_REALTIME_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'sync' }, (msg) => {
        const payload = msg?.payload as { rev?: number; source?: string } | undefined;
        if (payload?.source === serverInstanceId) return;
        if (!payload?.rev || payload.rev > db.rev) {
          void pollSupabaseRemoteChanges(true);
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void pollSupabaseRemoteChanges(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          void pollSupabaseRemoteChanges(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meta' },
        () => {
          void pollSupabaseRemoteChanges(true);
        }
      )
      .subscribe((status) => {
        supabaseRealtimeReady = status === 'SUBSCRIBED';
      });

    supabaseRealtimeChannel = channel;
  } catch {
    // Graceful fallback to lightweight polling if WebSocket unavailable
  }
}

function signAdminToken(secret: string, ttlMs = 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const nonce = crypto.randomBytes(12).toString('hex');
  const body = Buffer.from(JSON.stringify({ role: 'admin', exp, nonce })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminToken(token: string | undefined, secret: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  if (!body || !sig) return false;

  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function readBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const alt = req.headers['x-admin-token'];
  return typeof alt === 'string' ? alt.trim() : undefined;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // KeepAlive ping for SSE clients every 25s
  const pingTimer = setInterval(() => {
    for (const res of sseClients) {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        sseClients.delete(res);
      }
    }
  }, 25000);
  pingTimer.unref();

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      rev: db.rev,
      clients: sseClients.size,
      supabase: supabaseStatus,
      serverTime: Date.now(),
    });
  });

  app.get('/api/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      rev: db.rev,
      state: db.state,
      supabase: supabaseStatus,
      serverTime: Date.now(),
    });
  });

  app.post('/api/supabase/sync', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!supabaseConfig) {
      res.status(400).json({
        ok: false,
        error: 'Supabase environment variables configured nahi hain.',
        supabase: supabaseStatus,
      });
      return;
    }
    const status = await bootstrapOrSyncSupabase();
    if (status.schemaReady && status.connected) {
      await enqueueSupabasePush(db.state, db.rev);
    }
    res.json({
      ok: supabaseStatus.connected,
      rev: db.rev,
      state: db.state,
      supabase: supabaseStatus,
      serverTime: Date.now(),
    });
  });

  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    sseClients.add(res);
    const initialPayload = JSON.stringify({
      rev: db.rev,
      state: db.state,
      supabase: supabaseStatus,
      serverTime: Date.now(),
    });
    res.write(`id: ${db.rev}\nevent: sync\ndata: ${initialPayload}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.post('/api/dispatch', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const action = req.body?.action as StoreAction | undefined;
    if (!action || typeof action.type !== 'string') {
      res.status(400).json({ ok: false, error: 'Invalid action payload', rev: db.rev, state: db.state });
      return;
    }

    setMenu(db.state.menu);
    const result = applyStoreAction(db.state, action, Date.now());
    if (result.error) {
      res.status(400).json({
        ok: false,
        error: result.error,
        rev: db.rev,
        state: db.state,
        meta: result.meta,
        supabase: supabaseStatus,
      });
      return;
    }

    if (result.changed) {
      db = {
        rev: db.rev + 1,
        updatedAt: Date.now(),
        state: result.state,
      };
      setMenu(db.state.menu);
      atomicWriteJson(DB_FILE, db);
      broadcastSync();
      void enqueueSupabasePush(db.state, db.rev);
    }

    res.json({
      ok: true,
      rev: db.rev,
      state: db.state,
      meta: result.meta,
      supabase: supabaseStatus,
      serverTime: Date.now(),
    });
  });

  // Encrypted Admin Auth Endpoints
  app.post('/api/admin/login', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ ok: false, error: 'Password daalo.' });
      return;
    }

    const ok = await verifyPasswordAgainstDigest(password, authStore.digest);
    if (!ok) {
      res.status(401).json({ ok: false, error: 'Password galat hai. Dobara try karo.' });
      return;
    }

    const token = signAdminToken(authStore.tokenSecret);
    res.json({
      ok: true,
      token,
      algorithm: authStore.digest.algorithm,
      iterations: authStore.digest.iterations,
    });
  });

  app.post('/api/admin/verify', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = readBearerToken(req);
    const ok = verifyAdminToken(token, authStore.tokenSecret);
    res.json({
      ok,
      algorithm: authStore.digest.algorithm,
      iterations: authStore.digest.iterations,
    });
  });

  app.post('/api/admin/password', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = readBearerToken(req);
    if (!verifyAdminToken(token, authStore.tokenSecret)) {
      res.status(401).json({ ok: false, error: 'Admin session expire ho gaya. Dobara login karo.' });
      return;
    }

    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 6) {
      res.status(400).json({ ok: false, error: 'Naya password kam se kam 6 characters ka hona chahiye.' });
      return;
    }

    const currentOk = await verifyPasswordAgainstDigest(currentPassword, authStore.digest);
    if (!currentOk) {
      res.status(401).json({ ok: false, error: 'Purana password galat hai.' });
      return;
    }

    const nextDigest = await createPasswordDigest(newPassword);
    authStore = {
      digest: nextDigest,
      tokenSecret: authStore.tokenSecret,
      updatedAt: Date.now(),
    };
    atomicWriteJson(AUTH_FILE, authStore);
    const nextToken = signAdminToken(authStore.tokenSecret);
    res.json({
      ok: true,
      token: nextToken,
      algorithm: nextDigest.algorithm,
      iterations: nextDigest.iterations,
    });
  });

  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' && fs.existsSync(distIndex));

  if (isProd && fs.existsSync(distIndex)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  if (supabaseConfig) {
    startSupabaseRealtimeSubscription();
    void bootstrapOrSyncSupabase(true).then((status) => {
      if (status.connected) {
        console.log(`Supabase cloud sync connected (${supabaseConfig.projectRef})`);
      } else if (!status.schemaReady) {
        console.log(
          `Supabase configured (${supabaseConfig.projectRef}) - waiting for supabase.sql schema tables`
        );
      }
    });

    const supaSyncTimer = setInterval(() => {
      void pollSupabaseRemoteChanges(false);
    }, 3000);
    supaSyncTimer.unref();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Panda Momo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Panda Momo server:', err);
  process.exit(1);
});
