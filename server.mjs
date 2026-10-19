import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';

const root = new URL('./public/', import.meta.url);
const home = homedir();
const hermes = join(home, '.hermes');
const rag = join(home, '.openclaw/workspace/duckbot-rag-memory');

async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function json(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; } }

async function overview() {
  const jobs = await json(join(hermes, 'cron/jobs.json'), []);
  const config = await readFile(join(hermes, 'config.yaml'), 'utf8').catch(() => '');
  const opencode = await readFile(join(home, '.config/opencode/opencode.jsonc'), 'utf8').catch(() => '');
  const profiles = await exists(join(hermes, 'profiles'));
  return {
    product: 'DuckBot OS', version: '0.1.0', mode: 'local-first / preview',
    layers: {
      hermes: { status: 'connected', model: config.match(/default:\s*([^\s]+)/)?.[1] ?? 'unknown', profiles },
      rag: { status: (await exists(rag)) ? 'connected' : 'missing', path: 'duckbot-rag-memory' },
      systemOne: { status: 'planned', mode: 'shadow-only' },
      opencode: { status: 'configured', zenConfigured: /[\"'](?:opencode|zen)[\"']\s*:/i.test(opencode), localProviders: (opencode.match(/\"provider\"\s*:/g) || []).length }
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
    const requested = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
    const body = await readFile(new URL(requested, root));
    res.writeHead(200, { 'content-type': mime[extname(requested)] ?? 'text/plain; charset=utf-8' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 4177), '0.0.0.0', () => console.log('DuckBot OS listening on http://0.0.0.0:' + (process.env.PORT || 4177)));
