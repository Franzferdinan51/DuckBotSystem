import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';

const root = new URL('./public/', import.meta.url);
const home = homedir();
const hermes = join(home, '.hermes');
const rag = join(home, 'duckbot-rag-memory');
const SHIM_URL = process.env.SYSTEMONE_SHIM_URL || 'http://127.0.0.1:8765';

async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function json(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; } }

async function fetchShim(path, opts = {}) {
  try {
    const res = await fetch(`${SHIM_URL}${path}`, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body,
      signal: AbortSignal.timeout(3000),
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: null, body: null, error: String(err) };
  }
}

async function overview() {
  const jobs = await json(join(hermes, 'cron/jobs.json'), []);
  const config = await readFile(join(hermes, 'config.yaml'), 'utf8').catch(() => '');
  const opencode = await readFile(join(home, '.config/opencode/opencode.jsonc'), 'utf8').catch(() => '');
  const profiles = await exists(join(hermes, 'profiles'));

  // SystemOne shim health
  const shimHealth = await fetchShim('/healthz');
  let systemOne = { status: 'disconnected', mode: 'shadow-only' };
  if (shimHealth.ok && shimHealth.body) {
    systemOne = {
      status: 'connected',
      mode: 'active',
      model: shimHealth.body.model ?? 'unknown',
      backend: shimHealth.body.backend ?? 'local',
      url: SHIM_URL,
    };
  } else if (shimHealth.error) {
    systemOne = { status: 'disconnected', mode: 'shadow-only', reason: shimHealth.error };
  }

  return {
    product: 'DuckBot OS', version: '0.1.0', mode: 'local-first / preview',
    layers: {
      hermes: { status: 'connected', model: config.match(/default:\s*([^\s]+)/)?.[1] ?? 'unknown', profiles },
      rag: { status: (await exists(rag)) ? 'connected' : 'missing', path: 'duckbot-rag-memory' },
      systemOne,
      opencode: { status: 'configured', zenConfigured: /["'](?:opencode|zen)["']\s*:/i.test(opencode), localProviders: (opencode.match(/"provider"\s*:/g) || []).length }
    },
    fleet: [
      { name: 'Agent DuckBot', role: 'orchestrator', state: 'active', risk: 'approval-gated' },
      { name: 'Ops', role: 'systems and reliability', state: 'ready', risk: 'read-only default' },
      { name: 'Research', role: 'evidence and briefings', state: 'ready', risk: 'source-linked' },
      { name: 'Build', role: 'coding and verification', state: 'ready', risk: 'sandboxed changes' }
    ],
    automation: { jobs: Array.isArray(jobs) ? jobs.length : 0, policy: 'cron sensitive actions denied' },
    approvals: { pending: 0, policy: 'smart approval required for external or destructive actions' }
  };
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/overview') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(await overview()));
    }

    // SystemOne decision proxy: POST /api/systemone/decide -> shim
    if (req.url === '/api/systemone/decide' && req.method === 'POST') {
      const body = await readBody(req);
      const shimRes = await fetchShim('/v1/systemone/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      res.writeHead(shimRes.ok ? 200 : shimRes.status || 502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(shimRes.body ?? { error: shimRes.error }));
    }

    // SystemOne route proxy: POST /api/systemone/route -> shim
    if (req.url === '/api/systemone/route' && req.method === 'POST') {
      const body = await readBody(req);
      const shimRes = await fetchShim('/v1/systemone/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      res.writeHead(shimRes.ok ? 200 : shimRes.status || 502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(shimRes.body ?? { error: shimRes.error }));
    }

    const requested = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
    const body = await readFile(new URL(requested, root));
    res.writeHead(200, { 'content-type': mime[extname(requested)] ?? 'text/plain; charset=utf-8' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

server.listen(Number(process.env.PORT || 4177), '0.0.0.0', () => console.log('DuckBot OS listening on http://0.0.0.0:' + (process.env.PORT || 4177)));
